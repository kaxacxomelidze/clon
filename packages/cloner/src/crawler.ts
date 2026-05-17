import { chromium } from 'playwright';
import sparticuzChromium from '@sparticuz/chromium';
import PQueue from 'p-queue';
import { capturePage } from './capture.js';
import { logger } from './logger.js';
import { normalizePageUrl } from './pageUrls.js';
import type { ClonerOptions, PageRecord } from './types.js';

const IS_SERVERLESS = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const NAV_DELAY_MS = IS_SERVERLESS ? 50 : 250;
const PAGE_CAPTURE_TIMEOUT = IS_SERVERLESS ? 18_000 : 180_000;
const USER_AGENT = 'CLONYFY/0.1 (+local archival)';

async function fetchSitemap(origin: string): Promise<string[]> {
  const candidates = new Set([
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap.txt`,
  ]);
  const found: string[] = [];
  const fetchedSitemaps = new Set<string>();

  try {
    const robots = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(IS_SERVERLESS ? 2_000 : 5_000),
    });
    if (robots.ok) {
      const text = await robots.text();
      for (const match of text.matchAll(/^sitemap:\s*(\S+)/gim)) {
        candidates.add(match[1].trim());
      }
    }
  } catch {
    // robots sitemap hints are optional.
  }

  async function parseSitemapText(url: string, text: string) {
    if (url.endsWith('.txt')) {
      text.split('\n')
        .map((line) => line.trim())
        .filter((line) => normalizePageUrl(line))
        .forEach((line) => found.push(line));
      return;
    }

    if (/<sitemapindex/i.test(text)) {
      const nestedUrls = [...text.matchAll(/<sitemap>\s*<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi)]
        .map((m) => m[1].trim());
      for (const nestedUrl of nestedUrls.slice(0, IS_SERVERLESS ? 20 : 80)) {
        if (fetchedSitemaps.has(nestedUrl)) continue;
        fetchedSitemaps.add(nestedUrl);
        try {
          const res = await fetch(nestedUrl, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(IS_SERVERLESS ? 3_000 : 8_000),
          });
          if (res.ok) await parseSitemapText(nestedUrl, await res.text());
        } catch {
          // Skip unreachable child sitemap.
        }
      }
      return;
    }

    const locs = [...text.matchAll(/<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi)]
      .map((m) => m[1].trim())
      .filter((loc) => normalizePageUrl(loc));
    found.push(...locs);
  }

  for (const url of candidates) {
    if (fetchedSitemaps.has(url)) continue;
    fetchedSitemaps.add(url);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(IS_SERVERLESS ? 3_000 : 8_000),
      });
      if (!res.ok) continue;
      await parseSitemapText(url, await res.text());
      if (found.length > 0) {
        logger.info(`  Found ${found.length} URLs in sitemap: ${url}`);
        break;
      }
    } catch {
      // No sitemap at this location.
    }
  }
  return [...new Set(found)];
}

function routeForUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname || '/';
    return pathname === '/index.html' ? '/' : pathname;
  } catch {
    return '/';
  }
}

function extractLinksFromHtml(html: string, pageUrl: string, origin: string): string[] {
  const found = new Set<string>();
  const attrRe = /\b(?:href|to|routerlink|data-href|data-url|data-link|data-route|data-page)=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = attrRe.exec(html)) !== null) {
    const href = normalizePageUrl(match[1], pageUrl);
    if (href && new URL(href).origin === origin) found.add(href);
  }

  const metaRe = /<(?:link|meta)\b[^>]*(?:href|content)=["']([^"']+)["'][^>]*>/gi;
  while ((match = metaRe.exec(html)) !== null) {
    const href = normalizePageUrl(match[1], pageUrl);
    if (href && new URL(href).origin === origin) found.add(href);
  }

  return [...found];
}

async function fetchStaticPage(url: string, origin: string): Promise<{ record: PageRecord; links: string[] }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(IS_SERVERLESS ? 5_000 : 15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  if (contentType && !/(text\/html|application\/xhtml\+xml)/i.test(contentType)) {
    throw new Error(`Not an HTML page (${contentType})`);
  }
  const html = await res.text();
  const links = extractLinksFromHtml(html, url, origin);
  return {
    record: {
      url,
      route: routeForUrl(url),
      html,
      assets: [],
      network: [],
      failedAssets: [],
    },
    links,
  };
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
    executablePath: IS_SERVERLESS ? await sparticuzChromium.executablePath() : undefined,
    args: [
      ...(IS_SERVERLESS ? sparticuzChromium.args : []),
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const enqueue = (url: string, currentDepth: number) => {
    const clean = normalizePageUrl(url);
    if (!clean) return;
    try { if (new URL(clean).origin !== origin) return; } catch { return; }
    if (visited.has(clean)) return;
    if (visited.size >= opts.maxPages) return;
    visited.add(clean);

    queue.add(async () => {
      if (records.length >= opts.maxPages) return;
      await new Promise((r) => setTimeout(r, NAV_DELAY_MS));

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

        await context.addInitScript(() => {
          const collectNav = (value: unknown) => {
            try {
              if (typeof value !== 'string' && !(value instanceof URL)) return;
              const href = new URL(String(value), window.location.href).href;
              const key = '__clonyfyNavs';
              const current = ((window as Window & Record<string, string[]>)[key] ||= []);
              current.push(href);
              window.dispatchEvent(new CustomEvent('__cloner_nav__', { detail: href }));
            } catch {
              // Ignore invalid SPA route targets.
            }
          };
          const push = (window as Window).history.pushState.bind(history);
          const replace = (window as Window).history.replaceState.bind(history);
          (window as Window).history.pushState = function (...args) {
            push(...args);
            collectNav(args[2]);
          };
          (window as Window).history.replaceState = function (...args) {
            replace(...args);
            collectNav(args[2]);
          };
          window.addEventListener('popstate', () => collectNav(window.location.href));
        });

        logger.info(`  [${records.length + 1}/${opts.maxPages}] ${clean}`);
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        let timedOut = false;
        const capturePromise = capturePage(context, clean, assetsDir);
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            context?.close().catch(() => {});
            reject(new Error(`Page capture timed out after ${PAGE_CAPTURE_TIMEOUT / 1000}s`));
          }, PAGE_CAPTURE_TIMEOUT);
        });
        let result: Awaited<typeof capturePromise>;
        try {
          result = await Promise.race([capturePromise, timeoutPromise]);
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          if (timedOut) {
            await Promise.race([
              capturePromise.catch(() => undefined),
              new Promise((resolve) => setTimeout(resolve, 2_000)),
            ]);
          }
        }

        const { record, links } = result;
        records.push(record);
        onPage(record);

        if (currentDepth < opts.depth) {
          for (const link of new Set(links)) enqueue(link, currentDepth + 1);
        }
      } catch (err) {
        if (IS_SERVERLESS) {
          try {
            logger.info(`  [FALLBACK] Static HTML fetch for ${clean}`);
            const { record, links } = await fetchStaticPage(clean, origin);
            records.push(record);
            onPage(record);
            if (currentDepth < opts.depth) {
              for (const link of links) enqueue(link, currentDepth + 1);
            }
            return;
          } catch (fallbackErr) {
            logger.warn(`  [SKIP] ${clean}: ${(fallbackErr as Error).message}`);
            return;
          }
        }
        logger.warn(`  [SKIP] ${clean}: ${(err as Error).message}`);
      } finally {
        await context?.close().catch(() => {});
      }
    });
  };

  enqueue(opts.url, 0);

  logger.info('  Checking sitemap...');
  const sitemapUrls = await fetchSitemap(origin);
  for (const url of sitemapUrls) enqueue(url, 1);

  try {
    await queue.onIdle();
  } finally {
    await browser.close();
  }

  return records;
}
