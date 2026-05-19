import { chromium } from 'playwright';
import sparticuzChromium from '@sparticuz/chromium';
import PQueue from 'p-queue';
import { createHash } from 'crypto';
import { existsSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import mime from 'mime-types';
import { capturePage, extractCssUrls } from './capture.js';
import { logger } from './logger.js';
import { normalizePageUrl } from './pageUrls.js';
import type { AssetEntry, ClonerOptions, PageRecord } from './types.js';

export function isServerlessRuntime(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): boolean {
  return env.VERCEL === '1'
    || env.VERCEL === 'true'
    || env.CLONYFY_SERVERLESS === '1'
    || !!env.VERCEL_ENV
    || !!env.AWS_LAMBDA_FUNCTION_NAME
    || !!env.LAMBDA_TASK_ROOT
    || cwd.startsWith('/var/task');
}

const IS_SERVERLESS = isServerlessRuntime();

const NON_PAGE_EXTS = new Set([
  '.7z','.aac','.avi','.avif','.bin','.bmp','.css','.csv','.doc','.docx',
  '.eot','.exe','.gif','.gz','.ico','.jpeg','.jpg','.js','.json','.map',
  '.mjs','.mov','.mp3','.mp4','.ogg','.ogv','.otf','.pdf','.png','.ppt',
  '.pptx','.rar','.rss','.svg','.tar','.tgz','.ttf','.txt','.wav','.webm',
  '.webp','.woff','.woff2','.xls','.xlsx','.xml','.zip',
]);
const NAV_DELAY_MS = IS_SERVERLESS ? 50 : 250;
const PAGE_CAPTURE_TIMEOUT = IS_SERVERLESS ? 18_000 : 180_000;
const USER_AGENT = 'CLONYFY/0.1 (+local archival)';
const STATIC_ASSET_LIMIT = IS_SERVERLESS ? 80 : 250;
const STATIC_ASSET_TIMEOUT = IS_SERVERLESS ? 4_000 : 10_000;
const STATIC_ASSET_MAX_BYTES = (IS_SERVERLESS ? 8 : 50) * 1024 * 1024;

export function shouldUseBundledChromium(
  playwrightPath: string,
  platform: NodeJS.Platform = process.platform,
  serverless = IS_SERVERLESS,
): boolean {
  return serverless || (platform === 'linux' && !existsSync(playwrightPath));
}

export function systemBrowserChannel(
  playwrightPath: string,
  platform: NodeJS.Platform = process.platform,
  serverless = IS_SERVERLESS,
): 'msedge' | 'chrome' | undefined {
  if (serverless || existsSync(playwrightPath)) return undefined;
  if (platform === 'win32') return 'msedge';
  if (platform === 'darwin') return 'chrome';
  return undefined;
}

async function getChromiumLaunchOptions() {
  const playwrightPath = chromium.executablePath();
  const useBundledChromium = shouldUseBundledChromium(playwrightPath);
  const channel = systemBrowserChannel(playwrightPath);
  const executablePath = useBundledChromium ? await sparticuzChromium.executablePath() : undefined;

  if (useBundledChromium) {
    logger.debug(`  [BROWSER] Using bundled Chromium: ${executablePath}`);
  } else if (channel) {
    logger.debug(`  [BROWSER] Playwright Chromium missing; using system ${channel}`);
  }

  return {
    executablePath,
    channel,
    args: [
      ...(useBundledChromium ? sparticuzChromium.args : []),
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  };
}

function hashUrl(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 16);
}

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

function pushSrcsetUrls(value: string | null | undefined, out: Set<string>): void {
  if (!value) return;
  for (const part of value.split(',')) {
    const candidate = part.trim().split(/\s+/)[0];
    if (candidate) out.add(candidate);
  }
}

function extractStaticAssetUrls(html: string): string[] {
  const found = new Set<string>();
  const attrRe = /\b(?:src|href|poster|data-src|data-lazy-src|data-original|data-bg|data-background|data-image|data-bg-image|data-lazy-background)=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(html)) !== null) {
    const value = match[1].trim();
    if (value && !normalizePageUrl(value)) found.add(value);
  }

  const srcsetRe = /\b(?:srcset|data-srcset|data-lazy-srcset)=["']([^"']+)["']/gi;
  while ((match = srcsetRe.exec(html)) !== null) pushSrcsetUrls(match[1], found);

  for (const cssUrl of extractCssUrls(html)) found.add(cssUrl);
  return [...found];
}

async function saveStaticAsset(rawUrl: string, pageUrl: string, assetsDir: string): Promise<AssetEntry | null> {
  if (/^(data|blob|javascript|mailto|tel):/i.test(rawUrl)) return null;

  let absUrl: string;
  try {
    absUrl = new URL(rawUrl, pageUrl).href;
  } catch {
    return null;
  }

  try {
    const res = await fetch(absUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(STATIC_ASSET_TIMEOUT),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (/text\/html|application\/xhtml\+xml/i.test(contentType)) return null;

    const len = Number(res.headers.get('content-length') || 0);
    if (len > STATIC_ASSET_MAX_BYTES) return null;

    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > STATIC_ASSET_MAX_BYTES) return null;

    const cleanUrl = absUrl.split('?')[0].split('#')[0];
    const extFromPath = extname(new URL(cleanUrl).pathname).toLowerCase();
    const extFromMime = mime.extension(contentType);
    const ext = extFromPath || (extFromMime ? `.${extFromMime}` : '.bin');
    const filename = `${hashUrl(absUrl)}${ext}`;
    const localPath = join(assetsDir, filename);
    const webPath = `/_assets/${filename}`;
    if (!existsSync(localPath)) writeFileSync(localPath, body);

    return { originalUrl: absUrl, localPath: webPath };
  } catch {
    return null;
  }
}

async function fetchStaticPage(url: string, origin: string, assetsDir: string): Promise<{ record: PageRecord; links: string[] }> {
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
  const assets = new Map<string, AssetEntry>();

  let assetUrls = extractStaticAssetUrls(html).slice(0, STATIC_ASSET_LIMIT);
  for (const rawAssetUrl of assetUrls) {
    const saved = await saveStaticAsset(rawAssetUrl, url, assetsDir);
    if (!saved) continue;
    assets.set(saved.originalUrl, saved);

    if (/\.css(?:$|[?#])/i.test(saved.originalUrl)) {
      try {
        const cssRes = await fetch(saved.originalUrl, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(STATIC_ASSET_TIMEOUT),
        });
        if (cssRes.ok) {
          const cssText = await cssRes.text();
          const cssAssets = extractCssUrls(cssText).slice(0, STATIC_ASSET_LIMIT);
          assetUrls = assetUrls.concat(cssAssets);
          for (const cssAsset of cssAssets) {
            const cssSaved = await saveStaticAsset(cssAsset, saved.originalUrl, assetsDir);
            if (cssSaved) assets.set(cssSaved.originalUrl, cssSaved);
          }
        }
      } catch {
        // CSS dependency capture is best-effort.
      }
    }
  }

  return {
    record: {
      url,
      route: routeForUrl(url),
      html,
      assets: [...assets.values()],
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
  const launchOptions = await getChromiumLaunchOptions();

  const browser = await chromium.launch({
    headless: true,
    ...launchOptions,
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

      // Guard: skip URLs whose path extension is a known non-page type.
      // normalizePageUrl should catch these, but some URLs (sitemap entries,
      // JS-driven navigations) can arrive with encoded or unusual paths.
      const urlPathExt = extname(new URL(clean).pathname).toLowerCase();
      if (urlPathExt && NON_PAGE_EXTS.has(urlPathExt)) {
        logger.debug(`  [SKIP] ${clean}: non-page extension (${urlPathExt})`);
        return;
      }

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

        // Abort any navigation that triggers a file download — catches redirect
        // chains that resolve to PDFs or binaries not detectable by URL alone.
        context.on('download', (download) => {
          logger.debug(`  [SKIP] ${clean}: triggered a download (${download.suggestedFilename()})`);
          download.cancel().catch(() => {});
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
            const { record, links } = await fetchStaticPage(clean, origin, assetsDir);
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
