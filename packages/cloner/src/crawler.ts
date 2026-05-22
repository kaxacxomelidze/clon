import PQueue from 'p-queue';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import mime from 'mime-types';
import { capturePage, extractCssUrls } from './capture.js';
import { logger } from './logger.js';
import { normalizePageUrl } from './pageUrls.js';
import type { AssetEntry, ClonerOptions, PageRecord } from './types.js';

type ChromiumLauncher = typeof import('playwright-core').chromium;

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
const PAGE_CAPTURE_TIMEOUT = IS_SERVERLESS ? 35_000 : 180_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; CLONYFY/0.1; +local archival)';
const STATIC_ASSET_LIMIT = IS_SERVERLESS ? 80 : 250;
const STATIC_ASSET_TIMEOUT = IS_SERVERLESS ? 4_000 : 10_000;
const STATIC_PAGE_TIMEOUT = IS_SERVERLESS ? 12_000 : 15_000;
const STATIC_ASSET_MAX_BYTES = (IS_SERVERLESS ? 8 : 50) * 1024 * 1024;
const STATIC_ASSET_CONCURRENCY = IS_SERVERLESS ? 6 : 12;
const STATIC_PAGE_ASSET_TIMEOUT = IS_SERVERLESS ? 4_000 : 60_000;
export function shouldUseStaticFirstServerless(
  env: NodeJS.ProcessEnv = process.env,
  serverless = IS_SERVERLESS,
): boolean {
  if (!serverless) return false;
  if (env.CLONYFY_BROWSER_FIRST === '1') return false;
  return env.CLONYFY_STATIC_FIRST === '1';
}

const STATIC_FIRST_SERVERLESS = shouldUseStaticFirstServerless();

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

async function getChromiumLaunchOptions(chromium: ChromiumLauncher) {
  const playwrightPath = IS_SERVERLESS ? '' : chromium.executablePath();
  const useBundledChromium = shouldUseBundledChromium(playwrightPath);
  const channel = systemBrowserChannel(playwrightPath);
  const sparticuzChromium = useBundledChromium ? (await import('@sparticuz/chromium')).default : null;
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

function looksLikePageHref(value: string): boolean {
  const clean = value.trim();
  if (!clean || clean.startsWith('#')) return false;
  if (/^(https?:)?\/\//i.test(clean)) return true;
  if (clean.startsWith('/')) return true;
  if (/^[a-z0-9._~/-]+(?:[?#][^\s]*)?$/i.test(clean)) return true;
  return false;
}

function shouldSkipPageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const ext = extname(pathname).toLowerCase();
    if (ext && NON_PAGE_EXTS.has(ext)) return true;
    if (/^\/cdn-cgi\//i.test(pathname)) return true;
    return false;
  } catch {
    return true;
  }
}

function visitedPageVariants(url: string): string[] {
  try {
    const parsed = new URL(url);
    const base = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
    return base.endsWith('.html')
      ? [url, base.replace(/\.html$/i, '')]
      : [url, `${base}.html`];
  } catch {
    return [url];
  }
}

function extractLinksFromHtml(html: string, pageUrl: string, origin: string): string[] {
  const found = new Set<string>();
  const attrRe = /\b(?:href|to|routerlink|data-href|data-url|data-link|data-route|data-page)=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = attrRe.exec(html)) !== null) {
    if (!looksLikePageHref(match[1])) continue;
    const href = normalizePageUrl(match[1], pageUrl);
    if (href && new URL(href).origin === origin) found.add(href);
  }

  const linkRe = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  while ((match = linkRe.exec(html)) !== null) {
    if (!looksLikePageHref(match[1])) continue;
    const href = normalizePageUrl(match[1], pageUrl);
    if (href && new URL(href).origin === origin) found.add(href);
  }

  const metaRe = /<meta\b[^>]*>/gi;
  while ((match = metaRe.exec(html)) !== null) {
    const tag = match[0];
    if (!/\b(?:property|name)=["'](?:og:url|twitter:url|canonical)["']/i.test(tag)) continue;
    const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
    if (!content || !looksLikePageHref(content)) continue;
    const href = normalizePageUrl(content, pageUrl);
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
    mkdirSync(assetsDir, { recursive: true });
    if (!existsSync(localPath)) writeFileSync(localPath, body);

    return { originalUrl: absUrl, localPath: webPath };
  } catch {
    return null;
  }
}

async function runLimited<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await task(item);
    }
  });
  await Promise.allSettled(workers);
}

async function collectStaticAssets(
  html: string,
  url: string,
  assetsDir: string,
  maxAssets = STATIC_ASSET_LIMIT,
  maxDurationMs = STATIC_PAGE_ASSET_TIMEOUT,
): Promise<AssetEntry[]> {
  const assets = new Map<string, AssetEntry>();
  const startedAt = Date.now();
  const seenAssetUrls = new Set<string>();
  const cssAssetUrls: Array<{ rawUrl: string; baseUrl: string }> = [];

  const hasTime = () => Date.now() - startedAt < maxDurationMs;
  const remainingSlots = () => Math.max(0, maxAssets - seenAssetUrls.size);
  const saveAndTrack = async (rawAssetUrl: string, baseUrl: string) => {
    if (!hasTime() || remainingSlots() <= 0) return;
    let key = rawAssetUrl;
    try { key = new URL(rawAssetUrl, baseUrl).href; } catch {}
    if (seenAssetUrls.has(key)) return;
    seenAssetUrls.add(key);

    const saved = await saveStaticAsset(rawAssetUrl, baseUrl, assetsDir);
    if (!saved) return;
    assets.set(saved.originalUrl, saved);

    if (/\.css(?:$|[?#])/i.test(saved.originalUrl) && hasTime() && remainingSlots() > 0) {
      try {
        const cssRes = await fetch(saved.originalUrl, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(STATIC_ASSET_TIMEOUT),
        });
        if (cssRes.ok) {
          const cssText = await cssRes.text();
          cssAssetUrls.push(...extractCssUrls(cssText).map((rawUrl) => ({ rawUrl, baseUrl: saved.originalUrl })));
        }
      } catch {
        // CSS dependency capture is best-effort.
      }
    }
  };

  const assetUrls = extractStaticAssetUrls(html).slice(0, maxAssets);
  await runLimited(assetUrls, STATIC_ASSET_CONCURRENCY, (rawAssetUrl) => saveAndTrack(rawAssetUrl, url));

  if (hasTime() && cssAssetUrls.length > 0 && remainingSlots() > 0) {
    await runLimited(
      cssAssetUrls.slice(0, remainingSlots()),
      STATIC_ASSET_CONCURRENCY,
      (cssAssetUrl) => saveAndTrack(cssAssetUrl.rawUrl, cssAssetUrl.baseUrl),
    );
  }

  if (!hasTime()) {
    logger.info(`  [FALLBACK] Asset capture hit ${(maxDurationMs / 1000).toFixed(0)}s budget; continuing with ${assets.size} asset(s)`);
  }

  return [...assets.values()];
}

async function fetchStaticPage(
  url: string,
  origin: string,
  assetsDir: string,
  options: { captureAssets?: boolean; maxAssets?: number; maxAssetDurationMs?: number } = {},
): Promise<{ record: PageRecord; links: string[] }> {
  let res: Response | null = null;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= (IS_SERVERLESS ? 3 : 1); attempt++) {
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(STATIC_PAGE_TIMEOUT),
      });
      break;
    } catch (err) {
      lastErr = err;
      if (attempt < (IS_SERVERLESS ? 3 : 1)) {
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
      }
    }
  }
  if (!res) throw lastErr instanceof Error ? lastErr : new Error(String(lastErr || 'Static page fetch failed'));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  if (contentType && !/(text\/html|application\/xhtml\+xml)/i.test(contentType)) {
    throw new Error(`Not an HTML page (${contentType})`);
  }
  const html = await res.text();
  const links = extractLinksFromHtml(html, url, origin);
  const assets = options.captureAssets === false
    ? []
    : await collectStaticAssets(html, url, assetsDir, options.maxAssets, options.maxAssetDurationMs);

  return {
    record: {
      url,
      route: routeForUrl(url),
      html,
      assets,
      network: [],
      failedAssets: [],
    },
    links,
  };
}

async function crawlStatic(
  opts: ClonerOptions,
  origin: string,
  assetsDir: string,
  visited: Set<string>,
  records: PageRecord[],
  onPage: (record: PageRecord) => void,
  reason: string,
): Promise<PageRecord[]> {
  logger.warn(`  [FALLBACK] Using static HTML crawler (${reason})`);

  const staticQueue: Array<{ url: string; depth: number }> = [];
  const enqueueStatic = (url: string, currentDepth: number) => {
    const clean = normalizePageUrl(url);
    if (!clean) return;
    try { if (new URL(clean).origin !== origin) return; } catch { return; }
    if (shouldSkipPageUrl(clean)) return;
    if (visitedPageVariants(clean).some((variant) => visited.has(variant))) return;
    if (visited.size >= opts.maxPages) return;
    visited.add(clean);
    staticQueue.push({ url: clean, depth: currentDepth });
  };

  enqueueStatic(opts.url, 0);
  logger.info('  Checking sitemap...');
  const sitemapUrls = await fetchSitemap(origin);
  for (const url of sitemapUrls) enqueueStatic(url, 1);

  for (let index = 0; index < staticQueue.length && records.length < opts.maxPages; index++) {
    const item = staticQueue[index];
    logger.info(`  [${records.length + 1}/${opts.maxPages}] ${item.url}`);
    try {
      logger.info(`  [FALLBACK] Static HTML fetch for ${item.url}`);
      const { record, links } = await fetchStaticPage(item.url, origin, assetsDir, { captureAssets: false });
      records.push(record);
      if (item.depth < opts.depth) {
        for (const link of links) enqueueStatic(link, item.depth + 1);
      }
    } catch (fallbackErr) {
      logger.warn(`  [SKIP] ${item.url}: ${(fallbackErr as Error).message}`);
    }
  }

  if (records.length > 0) {
    logger.info(`  [FALLBACK] Capturing assets for ${records.length} static page(s)...`);
    await runLimited(records, Math.min(4, STATIC_ASSET_CONCURRENCY), async (record) => {
      record.assets = await collectStaticAssets(record.html, record.url, assetsDir, STATIC_ASSET_LIMIT, STATIC_PAGE_ASSET_TIMEOUT);
      onPage(record);
    });
  }

  return records;
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

  if (STATIC_FIRST_SERVERLESS) {
    return crawlStatic(opts, origin, assetsDir, visited, records, onPage, 'serverless static-first mode');
  }

  const { chromium } = await import('playwright-core');
  const launchOptions = await getChromiumLaunchOptions(chromium);

  let browser: Awaited<ReturnType<ChromiumLauncher['launch']>>;
  try {
    browser = await chromium.launch({
      headless: true,
      ...launchOptions,
    });
  } catch (err) {
    return crawlStatic(opts, origin, assetsDir, visited, records, onPage, `browser launch failed: ${(err as Error).message.split('\n')[0]}`);
  }

  const enqueue = (url: string, currentDepth: number) => {
    const clean = normalizePageUrl(url);
    if (!clean) return;
    try { if (new URL(clean).origin !== origin) return; } catch { return; }
    if (shouldSkipPageUrl(clean)) return;
    if (visitedPageVariants(clean).some((variant) => visited.has(variant))) return;
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
