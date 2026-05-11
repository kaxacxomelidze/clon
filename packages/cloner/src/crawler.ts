import { chromium } from 'playwright';
import PQueue from 'p-queue';
import { capturePage } from './capture.js';
import { logger } from './logger.js';
import type { ClonerOptions, PageRecord } from './types.js';

const NAV_DELAY_MS = 250;
const PAGE_CAPTURE_TIMEOUT = 120_000; // 2 min hard cap per page
const USER_AGENT = 'WebCloner/0.1 (+local archival)';

// Strip common tracking/UTM query params so the same page isn't crawled multiple times
// with different analytics decorations (e.g. ?utm_source=twitter vs ?utm_source=email).
const TRACKING_PARAM = /^(utm_|fbclid|gclid|msclkid|_ga|_gl|mc_eid|yclid|dclid|zanpid|igshid|twclid|li_fat_id|ttclid)/i;

// Auth/account pages that should not be cloned — they're user-specific flows, not content
const AUTH_PATH = /^\/(login|logout|signin|sign-in|sign-out|signout|register|signup|sign-up|forgot-password|reset-password|change-password|verify-email|confirm-email|auth|oauth|sso|account\/activate|account\/confirm)(\/|$|\?)/i;

function stripTrackingParams(href: string): string {
  try {
    const u = new URL(href);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
    }
    // Remove trailing '?' if all params were stripped
    return u.href;
  } catch { return href; }
}

async function fetchSitemap(origin: string): Promise<string[]> {
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap.txt`,
  ];
  const found: string[] = [];
  const fetchedSitemaps = new Set<string>();

  async function parseSitemapText(url: string, text: string) {
    if (url.endsWith('.txt')) {
      text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('http')).forEach((l) => found.push(l));
      return;
    }
    // Sitemap index: contains nested <sitemap><loc>…</loc></sitemap> entries
    if (/<sitemapindex/i.test(text)) {
      const nestedUrls = [...text.matchAll(/<sitemap>\s*<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
      for (const nestedUrl of nestedUrls.slice(0, 10)) {
        if (fetchedSitemaps.has(nestedUrl)) continue;
        fetchedSitemaps.add(nestedUrl);
        try {
          const r = await fetch(nestedUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) });
          if (r.ok) await parseSitemapText(nestedUrl, await r.text());
        } catch { /* skip unreachable child sitemap */ }
      }
    } else {
      const locs = [...text.matchAll(/<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
      found.push(...locs);
    }
  }

  for (const url of candidates) {
    if (fetchedSitemaps.has(url)) continue;
    fetchedSitemaps.add(url);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      await parseSitemapText(url, await res.text());
      if (found.length > 0) {
        logger.info(`  Found ${found.length} URLs in sitemap: ${url}`);
        break;
      }
    } catch { /* no sitemap */ }
  }
  return found;
}

export async function crawl(
  opts: ClonerOptions,
  assetsDir: string,
  onPage: (record: PageRecord) => void,
): Promise<PageRecord[]> {
  const origin = new URL(opts.url).origin;
  const visited = new Set<string>();
  const queue = new PQueue({ concurrency: opts.concurrency });
  const records: PageRecord[] = [];

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const enqueue = (url: string, currentDepth: number) => {
    // Normalize: strip fragment + tracking params, trailing slash (except root), /index.html → /
    let clean = url.split('#')[0];
    try {
      const u = new URL(clean);
      if (u.pathname === '/index.html') {
        u.pathname = '/'; // treat /index.html as root
      } else if (u.pathname !== '/' && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.slice(0, -1);
      }
      clean = stripTrackingParams(u.href);
    } catch { return; }

    // Skip auth/registration pages — they're user-specific flows, not site content
    try { if (AUTH_PATH.test(new URL(clean).pathname)) return; } catch { return; }

    if (visited.has(clean)) return;
    if (records.length + queue.size + queue.pending >= opts.maxPages) return;
    visited.add(clean);

    queue.add(async () => {
      if (records.length >= opts.maxPages) return;
      await new Promise((r) => setTimeout(r, NAV_DELAY_MS));

      // Declare before try so the finally block can always close it, even if
      // newContext() succeeds but addInitScript() throws (resource leak otherwise).
      let context: Awaited<ReturnType<typeof browser.newContext>> | null = null;
      try {
        context = await browser.newContext({
          userAgent: USER_AGENT,
          viewport: { width: 1440, height: 900 },
          ignoreHTTPSErrors: true,
          extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        // Patch pushState/replaceState so SPA navigations are visible as events.
        // (The __cloner_nav__ event lets future tooling hook in without re-architecting capture.)
        await context.addInitScript(() => {
          const push = (window as Window).history.pushState.bind(history);
          const replace = (window as Window).history.replaceState.bind(history);
          (window as Window).history.pushState = function (...args) {
            push(...args);
            window.dispatchEvent(new CustomEvent('__cloner_nav__', { detail: args[2] }));
          };
          (window as Window).history.replaceState = function (...args) {
            replace(...args);
            window.dispatchEvent(new CustomEvent('__cloner_nav__', { detail: args[2] }));
          };
        });

        logger.info(`  [${records.length + 1}/${opts.maxPages}] ${clean}`);
        // Timeout that is always cleared — leaving a dangling setTimeout causes an
        // unhandled rejection 120 s later on every *successful* capture in Node ≥ 15.
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        const { record, links } = await Promise.race([
          capturePage(context, clean, assetsDir).then((result) => {
            clearTimeout(timeoutHandle);
            return result;
          }, (err) => {
            clearTimeout(timeoutHandle);
            throw err;
          }),
          new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
              () => reject(new Error(`Page capture timed out after ${PAGE_CAPTURE_TIMEOUT / 1000}s`)),
              PAGE_CAPTURE_TIMEOUT,
            );
          }),
        ]);
        records.push(record);
        onPage(record);

        if (currentDepth < opts.depth) {
          const allLinks = new Set(links);
          for (const link of allLinks) {
            const linkClean = link.split('#')[0];
            try {
              const u = new URL(linkClean);
              if (u.origin === origin) enqueue(linkClean, currentDepth + 1);
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        logger.warn(`  [SKIP] ${clean}: ${(err as Error).message}`);
      } finally {
        await context?.close().catch(() => {});
      }
    });
  };

  // 1. Start with the seed URL
  enqueue(opts.url, 0);

  // 2. Discover pages from sitemap — no pre-slice; enqueue() enforces maxPages internally
  logger.info('  Checking sitemap...');
  const sitemapUrls = await fetchSitemap(origin);
  for (const u of sitemapUrls) {
    try {
      const parsed = new URL(u);
      if (parsed.origin === origin) enqueue(u, 1);
    } catch { /* skip */ }
  }

  try {
    await queue.onIdle();
  } finally {
    await browser.close();
  }

  return records;
}
