import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import mime from 'mime-types';
import type { BrowserContext } from 'playwright';
import type { AssetEntry, NetworkEntry, PageRecord } from './types.js';
import { logger } from './logger.js';
import { normalizePageUrl } from './pageUrls.js';

const ASSET_EXTS = new Set([
  '.css', '.js', '.mjs', '.png', '.jpg', '.jpeg', '.gif', '.svg',
  '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.avif',
  '.mp4', '.webm', '.ogg', '.mp3', '.wav', '.pdf', '.json',
]);

const SKIP_ASSET_PATTERNS = [
  /^data:/,
  /^blob:/,
  /^javascript:/,
  /^mailto:/,
  /\.(map)$/i,
  /\/sockjs-node\//,
  /hot-update/,
  /webpack-hmr/,
];

// Requests from these CDNs never need to be fetched/saved - they're map tiles,
// analytics pings, or other noise that prevents networkidle from settling.
const ABORT_PATTERNS = [
  // Map tiles (all tile CDNs)
  /\/\/[abc]\.\w+\.tile\./,
  /tile\.openstreetmap\.org/,
  /maps\.googleapis\.com\/maps\/vt/,
  /api\.mapbox\.com\/styles.*\/tiles/,
  /maps\.gstatic\.com/,
  /cdn\.jsdelivr\.net\/npm\/leaflet.*marker/,
  // Map embed iframes - aborting here prevents the embed JS from even loading,
  // which eliminates the ERR_FAILED tile-fetch console error flood.
  /openstreetmap\.org\/export\/embed/,
  /maps\.google\.com\/maps\?/,
  /google\.com\/maps\/embed/,
  /bing\.com\/maps\/embed/,
  /yandex\.\w+\/map-widget/,
  /2gis\.com\/widget/,
  // Analytics beacons - tracking pings that keep networkidle from settling (NOT the JS files)
  /google-analytics\.com\/[rj]?\/?(collect|r\/collect)/,
  /analytics\.google\.com\/g\/collect/,
  /\bgtm\.js\?id=/,
  /pagead\/viewthroughconversion/,
  /\/bat\.bing\.com\//,
  /clarity\.ms\/collect/,
  /doubleclick\.net\/pagead/,
  /\/tr\?id=[^&]+&ev=/,              // Meta/Facebook pixel events
  /hotjar\.com\/api\/trigger/,
  /cdn\.segment\.com\/analytics\.js\/v1\/[^/]+\/analytics\.min\.js/, // Segment (large, rarely needed)
  /\/log\?format=json&hasfast=true/, // YouTube-specific internal ping
  /\/generate_204/,                  // Chrome connectivity check
  /\/pagead\/lvz/,                   // Google Ads viewability ping
  /\/ccm\/collect/,                  // Google consent
  /\/api\/stats\/(qoe|ads|atr)/,     // YouTube stats pings
  /\/api\/jnn\//,                    // YouTube Jnn telemetry
  /\/youtubei\/v1\/(log|stats)/,     // YouTube internal logging
  // Live chat widgets - these poll aggressively and prevent networkidle
  /intercom\.io\/messenger\//,
  /widget\.intercom\.io/,
  /js\.driftt\.com/,
  /widget\.drift\.com/,
  /js\.hs-scripts\.com/,            // HubSpot embed
  /js-[a-z0-9]+\.hs-scripts\.com/,
  /api\.hubspot\.com\/conversations/,
  /js-[a-z0-9]+\.hsforms\.net\/forms\//, // HubSpot forms runtime
  /forms-[a-z0-9]+\.hsforms\.com\//,     // HubSpot forms API/counters
  /static\.hsappstatic\.net\/ui-forms-embed-components-app\//,
  /hubspotv2\.[^/]+\.webflow\.services\/static\//,
  /cdn\.livechatinc\.com/,
  /lc\.chat\//,
  /static\.zdassets\.com/,          // Zendesk widget
  /ekr\.zdassets\.com/,
  /widget\.freshworks\.com/,
  /wchat\.freshchat\.com/,
  // Cookie consent banners that make long-polling requests
  /consent\.cookiebot\.com\/uc\.js/,
  /cdn\.cookielaw\.org\/scripttemplates/,
  // Payment widgets - Stripe makes persistent keep-alive requests
  /js\.stripe\.com\/v3/,
  /m\.stripe\.network/,
  /r\.stripe\.com/,
  // Social embeds - Twitter, Facebook, Instagram, LinkedIn, TikTok
  /platform\.twitter\.com\/widgets/,
  /syndication\.twitter\.com/,
  /connect\.facebook\.net\/[^/]+\/sdk/,
  /www\.facebook\.com\/plugins\//,
  /www\.instagram\.com\/embed/,
  /badges\.linkedin\.com/,
  /www\.tiktok\.com\/embed/,
  // Comments - Disqus makes many polling requests
  /disqus\.com\/embed\//,
  /disquscdn\.com\/next\/embed/,
  // CAPTCHA - these phone home with challenge tokens
  /www\.google\.com\/recaptcha\/api/,
  /www\.gstatic\.com\/recaptcha/,
  /challenges\.cloudflare\.com\/turnstile/,
  // Additional chat widgets
  /embed\.tawk\.to/,               // Tawk.to live chat
  /client\.crisp\.chat/,           // Crisp chat
  /widget\.tidio\.co/,             // Tidio
  /app\.chatra\.io/,               // Chatra
  // Error reporting beacons
  /sentry\.io\/api\/[0-9]+\/envelope/,
  /ingest\.sentry\.io/,
  /browser\.sentry-cdn\.com/,
];

const SCRIPT_STUB_PATTERNS = [
  /js\.hs-scripts\.com/,
  /js-[a-z0-9]+\.hs-scripts\.com/,
  /js-[a-z0-9]+\.hsforms\.net\/forms\//,
  /hubspotv2\.[^/]+\.webflow\.services\/static\//,
];

const HUBSPOT_FORM_STUB = `
window.hbspt = window.hbspt || {};
window.hbspt.forms = window.hbspt.forms || {};
window.hbspt.forms.create = window.hbspt.forms.create || function () {};
`;

const IS_SERVERLESS = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const NAVIGATION_TIMEOUT = IS_SERVERLESS ? 12_000 : 30_000;
const ROUTE_FETCH_TIMEOUT = IS_SERVERLESS ? 5_000 : 15_000;
const USER_AGENT = 'CLONYFY/0.1 (+local archival)';
const MAX_ASSET_BYTES = (IS_SERVERLESS ? 8 : 50) * 1024 * 1024; // Keep serverless clones inside Vercel limits.
const MAX_CSS_BYTES = (IS_SERVERLESS ? 5 : 25) * 1024 * 1024; // CSS bundles can be larger than media icons/fonts.
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ax3p9QAAAAASUVORK5CYII=',
  'base64',
);

function hashUrl(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 16);
}

function shouldSkipAsset(url: string): boolean {
  return SKIP_ASSET_PATTERNS.some((p) => p.test(url));
}

function shouldReportConsoleError(text: string): boolean {
  // Browser "failed to load resource" console lines are usually source-site
  // broken images/beacons. They are handled through asset fallback/rewriting and
  // should not make the clone health panel look broken.
  return !/^Failed to load resource:/i.test(text);
}

function shouldReportPageError(message: string): boolean {
  // Several source sites ship noisy third-party/template scripts that throw this
  // while the rendered DOM is still usable. Keep it in debug logs, but don't
  // count it as a clone script issue.
  const clean = message.trim();
  return !/^Invalid or unexpected token$/i.test(clean)
    && !/^__name is not defined$/i.test(clean);
}

function isImageLikeRequest(url: string, resourceType: string): boolean {
  if (resourceType === 'image') return true;
  try {
    const ext = extname(new URL(url.split('?')[0]).pathname).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.avif'].includes(ext);
  } catch {
    return false;
  }
}

// Extract url() references from CSS text
export function extractCssUrls(css: string): string[] {
  const urls: string[] = [];
  const re = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const u = m[2];
    if (!shouldSkipAsset(u)) urls.push(u);
  }
  // @import "url" and @import url(...)
  const importRe = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g;
  while ((m = importRe.exec(css)) !== null) {
    if (!shouldSkipAsset(m[1])) urls.push(m[1]);
  }
  return urls;
}

// Rewrite url() references in CSS text
function mapAssetUrl(url: string, assetMap: Map<string, string>, baseUrl?: string): string | null {
  const clean = url.split('?')[0].split('#')[0];
  const direct = assetMap.get(url) ?? assetMap.get(clean);
  if (direct) return direct;

  if (baseUrl) {
    try {
      const abs = new URL(url, baseUrl).href;
      return assetMap.get(abs) ?? assetMap.get(abs.split('?')[0].split('#')[0]) ?? null;
    } catch { /* leave unparseable CSS values unchanged */ }
  }

  return null;
}

export function rewriteCssUrls(css: string, assetMap: Map<string, string>, baseUrl?: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")\s]+)\1\s*\)/g, (match, quote, url) => {
    const mapped = mapAssetUrl(url, assetMap, baseUrl);
    return mapped ? `url(${quote}${mapped}${quote})` : match;
  }).replace(/@import\s+(?:url\(\s*)?(?:(['"])([^'")]+)\1|([^'")\s;]+))\s*\)?/g, (match, _quote, quotedUrl, bareUrl) => {
    const url = quotedUrl || bareUrl;
    const mapped = mapAssetUrl(url, assetMap, baseUrl);
    return mapped ? match.replace(url, mapped) : match;
  });
}

export async function capturePage(
  context: BrowserContext,
  pageUrl: string,
  assetsDir: string,
): Promise<{ record: PageRecord; links: string[] }> {
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'User-Agent': USER_AGENT });
  await page.addInitScript(() => {
    const win = window as Window & { __name?: <T>(value: T) => T };
    win.__name ||= (value) => value;
  });

  const networkLog: NetworkEntry[] = [];
  const assetMap = new Map<string, string>(); // original URL -> /_assets/filename
  const pendingAssets: Array<() => Promise<void>> = [];
  const processedCssRefs = new Set<string>();
  const consoleErrors: string[] = [];
  // Track CSS local paths -> original text so we can rewrite url() refs after all assets are known
  const cssFilesForRewrite = new Map<string, { localPath: string; cssText: string; sourceUrl: string }>();

  const failedAssets = new Set<string>();
  let assetsIntercepted = 0;
  let assetsSaved = 0;
  let assetsSkipped = 0;
  let networkRequests = 0;

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      logger.debug(`  [CONSOLE ERROR] ${text}`);
      if (shouldReportConsoleError(text)) {
        consoleErrors.push(text);
      }
    }
  });

  // URLs whose JSON responses caused a pageerror - stub them as {} on second pass
  const cmsJsonStubs = new Set<string>();

  page.on('pageerror', (err) => {
    const text = `PageError: ${err.message}`;
    if (shouldReportPageError(err.message)) {
      consoleErrors.push(text);
      logger.debug(`  [PAGE ERROR] ${err.message}`);
    } else {
      logger.debug(`  [PAGE ERROR IGNORED] ${err.message}`);
    }
    // "Invalid or unexpected token" almost always comes from eval()/template-literal
    // processing of a JSON API response that contains backticks or unescaped chars.
    // Track the most-recently-seen JSON XHR URLs so we can stub them if needed.
    if (/invalid or unexpected token/i.test(err.message)) {
      for (const entry of networkLog) {
        if (entry.contentType.includes('application/json') && entry.method !== 'CONSOLE_ERROR') {
          cmsJsonStubs.add(entry.url);
        }
      }
    }
  });

  async function saveAsset(url: string, body: Buffer, contentType: string, forceCss = false): Promise<string | null> {
    if (shouldSkipAsset(url)) return null;
    const maxBytes = (forceCss || contentType.includes('text/css')) ? MAX_CSS_BYTES : MAX_ASSET_BYTES;
    if (body.length > maxBytes) {
      logger.debug(`  [ASSET SKIP] ${url} - too large (${(body.length / 1024 / 1024).toFixed(1)}MB > ${(maxBytes / 1024 / 1024).toFixed(0)}MB)`);
      return null;
    }
    try {
      const cleanUrl = url.split('?')[0].split('#')[0];
      const hash = hashUrl(url);
      const extFromPath = extname(new URL(cleanUrl).pathname).toLowerCase();
      const extFromMime = mime.extension(contentType);
      const ext = forceCss ? '.css' : (extFromPath || (extFromMime ? `.${extFromMime}` : '.bin'));
      const filename = `${hash}${ext}`;
      const localPath = join(assetsDir, filename);
      const webPath = `/_assets/${filename}`;
      mkdirSync(assetsDir, { recursive: true });

      const isCss = forceCss || ext === '.css' || contentType.includes('text/css');

      if (isCss) {
        // Always track CSS for url() post-processing - even if the file already exists
        // (e.g. from a prior run or a second page requesting the same stylesheet).
        const cssText = body.toString('utf8');
        if (!existsSync(localPath)) {
          writeFileSync(localPath, body);
          assetsSaved++;
          logger.debug(`  [CSS]   ${webPath}  <-  ${url}  (${(body.length / 1024).toFixed(1)}KB, will rewrite urls)`);
        }
        cssFilesForRewrite.set(webPath, { localPath, cssText, sourceUrl: url });
      } else {
        if (!existsSync(localPath)) {
          writeFileSync(localPath, body);
          assetsSaved++;
          logger.debug(`  [ASSET] ${webPath}  <-  ${url}  (${(body.length / 1024).toFixed(1)}KB, ${contentType.split(';')[0]})`);
        }
      }

      assetMap.set(url, webPath);
      assetMap.set(cleanUrl, webPath);
      return webPath;
    } catch (err) {
      logger.warn(`  [ASSET FAIL] ${url}: ${(err as Error).message}`);
      return null;
    }
  }

  function enqueueCssReferences(cssText: string, sourceUrl: string): void {
    if (processedCssRefs.has(sourceUrl)) return;
    processedCssRefs.add(sourceUrl);

    const cssUrls = extractCssUrls(cssText);
    if (cssUrls.length > 0) {
      logger.debug(`  [CSS REFS] ${cssUrls.length} url() references in ${sourceUrl}`);
    }

    for (const cssUrl of cssUrls) {
      pendingAssets.push(async () => {
        try {
          const absUrl = new URL(cssUrl, sourceUrl).href;
          if (assetMap.has(absUrl)) return;
          const r = await fetch(absUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) });
          if (!r.ok) {
            logger.debug(`  [CSS REF FAIL] ${absUrl} -> HTTP ${r.status}`);
            return;
          }

          const contentType = r.headers.get('content-type') ?? '';
          const pathExt = extname(new URL(absUrl.split('?')[0]).pathname).toLowerCase();
          const isCssRef = contentType.includes('text/css') || pathExt === '.css';
          const maxBytes = isCssRef ? MAX_CSS_BYTES : MAX_ASSET_BYTES;
          const len = Number(r.headers.get('content-length') || 0);
          if (len > maxBytes) {
            logger.debug(`  [CSS REF SKIP] ${absUrl} - too large (${(len / 1024 / 1024).toFixed(1)}MB > ${(maxBytes / 1024 / 1024).toFixed(0)}MB)`);
            return;
          }

          const subBuf = Buffer.from(await r.arrayBuffer());
          const saved = await saveAsset(absUrl, subBuf, contentType, isCssRef);
          if (!saved) {
            logger.debug(`  [CSS REF SKIP] ${absUrl}`);
            return;
          }

          if (isCssRef && subBuf.length < 500_000) {
            enqueueCssReferences(subBuf.toString('utf8'), absUrl);
          }
        } catch (err) {
          logger.debug(`  [CSS REF ERR] ${cssUrl}: ${(err as Error).message}`);
        }
      });
    }
  }

  // Intercept all network traffic
  await page.route('**/*', async (route) => {
    const req = route.request();
    const resourceType = req.resourceType();
    const url = req.url();
    networkRequests++;

    if (shouldSkipAsset(url)) {
      assetsSkipped++;
      await route.continue();
      return;
    }

    if (resourceType === 'script' && SCRIPT_STUB_PATTERNS.some((p) => p.test(url))) {
      logger.debug(`  [SCRIPT STUB] ${url}`);
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: HUBSPOT_FORM_STUB,
      });
      return;
    }

    if (ABORT_PATTERNS.some((p) => p.test(url))) {
      logger.debug(`  [ABORT] ${url}`);
      await route.abort();
      return;
    }

    // Stub JSON API responses that previously caused a pageerror SyntaxError
    if (cmsJsonStubs.has(url)) {
      logger.debug(`  [CMS STUB] ${url} -> {} (caused pageerror on prior load)`);
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: '{}' });
      return;
    }

    let response;
    try {
      response = await route.fetch({ timeout: ROUTE_FETCH_TIMEOUT });
    } catch (err) {
      logger.debug(`  [FETCH FAIL] ${url}: ${(err as Error).message}`);
      await route.abort();
      return;
    }

    const status = response.status();
    const contentType = response.headers()['content-type'] ?? '';
    let _pathExt = '';
    try { _pathExt = extname(new URL(url.split('?')[0]).pathname).toLowerCase(); } catch { /* ignore */ }
    const isStylesheetRequest = resourceType === 'stylesheet';
    const isAsset = isStylesheetRequest
      || ASSET_EXTS.has(_pathExt)
      || contentType.startsWith('image/')
      || contentType.startsWith('font/')
      || contentType.startsWith('text/css')
      || contentType.includes('javascript');
    const isJson = contentType.includes('application/json');
    const isText = contentType.startsWith('text/');
    // Check path extension precisely - url.includes('.css') would match /api/file?name=style.css
    const isCss = isStylesheetRequest || contentType.includes('text/css') || _pathExt === '.css';
    const loggedContentType = isCss && !contentType.includes('text/css')
      ? 'text/css; charset=utf-8'
      : contentType;

    if (status >= 400 && isImageLikeRequest(url, resourceType)) {
      failedAssets.add(url);
      logger.debug(`  [IMAGE FALLBACK] ${url} -> HTTP ${status}, substituting transparent pixel`);
      await route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG });
      return;
    }

    let body: string | null = null;
    if ((isJson || isText) && resourceType !== 'document') {
      try { body = (await response.text()).slice(0, 500_000); } catch { /* ignore */ }
    }

    if (resourceType === 'script') {
      const badScriptType = contentType.includes('text/html')
        || contentType.includes('application/json')
        || contentType.includes('text/xml')
        || contentType.includes('application/xml');
      const looksLikeHtml = typeof body === 'string' && /^\s*</.test(body);
      if (badScriptType || looksLikeHtml) {
        logger.debug(`  [JS STUB] ${url} -> ${contentType || 'unknown content type'}, substituting empty script`);
        await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: '/* stubbed invalid script response */' });
        return;
      }
    }

    if (resourceType !== 'document') {
      networkLog.push({
        method: req.method(),
        url,
        postData: req.postData(),
        status,
        contentType: loggedContentType,
        body,
      });
      logger.debug(`  [NET] ${req.method()} ${status} ${loggedContentType.split(';')[0].padEnd(30)} ${url}`);
    }

    // Script resource returning an error -> substitute empty JS to prevent syntax errors
    if ((contentType.includes('javascript') || resourceType === 'script') && status >= 400) {
      logger.debug(`  [JS STUB] ${url} -> HTTP ${status}, substituting empty script`);
      await route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: '/* stub */' });
      return;
    }

    // XHR/fetch returning text/html with 4xx/5xx is always an error page (not the intended data).
    // Stub as {} so the site's JS doesn't crash trying to eval/parse HTML.
    if ((resourceType === 'xhr' || resourceType === 'fetch') && contentType.includes('text/html') && status >= 400) {
      logger.debug(`  [XHR STUB] ${url} -> HTTP ${status} text/html, substituting {}`);
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: '{}' });
      return;
    }

    if (isAsset && status === 200) {
      assetsIntercepted++;
      try {
        const maxBytes = isCss ? MAX_CSS_BYTES : MAX_ASSET_BYTES;
        const len = Number(response.headers()['content-length'] || 0);
        if (len > maxBytes) {
          logger.debug(`  [ASSET SKIP] ${url} - too large (${(len / 1024 / 1024).toFixed(1)}MB > ${(maxBytes / 1024 / 1024).toFixed(0)}MB)`);
          await route.fulfill({ response });
          return;
        }
        const buf = await response.body();
        if (buf.length > maxBytes) {
          logger.debug(`  [ASSET SKIP] ${url} - too large (${(buf.length / 1024 / 1024).toFixed(1)}MB > ${(maxBytes / 1024 / 1024).toFixed(0)}MB)`);
          await route.fulfill({ response });
          return;
        }
        const webPath = await saveAsset(url, buf, contentType, isCss);

        if (webPath && isCss && buf.length < 500_000) {
          enqueueCssReferences(buf.toString('utf8'), url);
        }

      } catch (err) {
        logger.debug(`  [BODY ERR] ${url}: ${(err as Error).message}`);
      }
    }

    await route.fulfill({ response });
  });

  try { // outer try - ensures page.close() always runs
  logger.debug(`  [NAV] -> ${pageUrl}`);
  try {
    const mainResponse = await page.goto(pageUrl, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT });
    const status = mainResponse?.status();
    if (status && status >= 400) {
      throw new Error(`HTTP ${status}`);
    }
    logger.debug(`  [NAV] load fired for ${pageUrl}`);
    // Wait for networkidle - aborted beacon patterns above help this settle quickly
    await page.waitForLoadState('networkidle', { timeout: IS_SERVERLESS ? 2_000 : 15_000 }).catch(() => {});
    logger.debug(`  [NAV] networkidle settled for ${pageUrl}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNonFatal = msg.includes('ERR_ABORTED') || msg.includes('net::ERR') || msg.toLowerCase().includes('timeout');
    if (!isNonFatal) throw err;
    logger.debug(`  [NAV WARN] ${msg}`);
  }

  // Wait for web fonts so the HTML snapshot reflects the real rendered state
  await page.evaluate(() => document.fonts.ready).catch(() => {});

  // Scroll to trigger lazy-loaded images and content.
  // Re-check scrollHeight each step - some sites (infinite scroll, lazy sections) grow the page as you scroll.
  await page.evaluate(async (fast: boolean) => {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const step = Math.max(window.innerHeight, 400);
    const started = Date.now();
    const maxSteps = fast ? 8 : 28;
    let y = 0;
    let steps = 0;
    while (y < document.body.scrollHeight && steps < maxSteps && Date.now() - started < (fast ? 1_200 : 6_000)) {
      window.scrollTo(0, y);
      await delay(fast ? 30 : 80);
      y += step;
      steps++;
    }
    window.scrollTo(0, document.body.scrollHeight);
    await delay(fast ? 40 : 120);
    window.scrollTo(0, 0);
  }, IS_SERVERLESS).catch((err) => {
    logger.debug(`  [SCROLL WARN] ${(err as Error).message}`);
  });

  // Wait for lazy images to finish loading
  try {
    await page.waitForFunction(() => {
      const imgs = Array.from(document.querySelectorAll('img[loading="lazy"], img[data-src]'));
      return imgs.every((img) => (img as HTMLImageElement).complete);
    }, undefined, { timeout: IS_SERVERLESS ? 600 : 2_000 });
  } catch { /* timeout is fine */ }

  // Some sites keep images/videos only in lazy data-* attributes until custom JS runs.
  // Collect those URLs explicitly so the clone includes assets that never fired a request.
  const domAssetUrls = await page.evaluate(() => {
    const urls: string[] = [];
    const push = (value: string | null) => {
      if (!value) return;
      const v = value.trim();
      if (!v || v.startsWith('#')) return;
      urls.push(v);
    };
    const pushSrcset = (value: string | null) => {
      if (!value) return;
      for (const part of value.split(',')) {
        const url = part.trim().split(/\s+/)[0];
        push(url);
      }
    };

    document.querySelectorAll('img,source,video,embed,object').forEach((el) => {
      for (const attr of ['src', 'poster', 'data-src', 'data-lazy-src', 'data-original', 'data-url', 'data-video', 'data-poster']) {
        push(el.getAttribute(attr));
      }
      for (const attr of ['srcset', 'data-srcset', 'data-lazy-srcset']) {
        pushSrcset(el.getAttribute(attr));
      }
    });
    // Intentionally skip <iframe src> - those are navigational HTML pages, not downloadable assets.

    document.querySelectorAll('[data-bg],[data-background],[data-image],[data-bg-image],[data-lazy-background]').forEach((el) => {
      for (const attr of ['data-bg', 'data-background', 'data-image', 'data-bg-image', 'data-lazy-background']) {
        push(el.getAttribute(attr));
      }
    });

    document.querySelectorAll('link[href]').forEach((el) => {
      const rel = (el.getAttribute('rel') ?? '').toLowerCase();
      if (/(stylesheet|preload|modulepreload|icon|apple-touch-icon|manifest)/.test(rel)) {
        push(el.getAttribute('href'));
      }
    });

    // Dynamically injected scripts may not have fired through route interception
    document.querySelectorAll('script[src]').forEach((el) => push(el.getAttribute('src')));

    return [...new Set(urls)];
  }).catch((err) => {
    logger.debug(`  [DOM ASSETS WARN] ${(err as Error).message}`);
    return [] as string[];
  });

  if (domAssetUrls.length > 0) {
    logger.debug(`  [DOM ASSETS] ${domAssetUrls.length} lazy/data asset refs found`);
  }

  const domAssetUrlsToFetch = IS_SERVERLESS ? domAssetUrls.slice(0, 30) : domAssetUrls;
  for (const u of domAssetUrlsToFetch) {
    if (!assetMap.has(u) && !shouldSkipAsset(u) && !ABORT_PATTERNS.some((p) => p.test(u))) {
      pendingAssets.push(async () => {
        try {
          const absUrl = new URL(u, pageUrl).href;
          if (assetMap.has(absUrl)) return;
          const r = await fetch(absUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(IS_SERVERLESS ? 3_000 : 10_000) });
          if (r.ok) {
            const contentType = r.headers.get('content-type') ?? '';
            if (contentType.includes('text/html')) {
              logger.debug(`  [DOM ASSET SKIP] ${absUrl} - document response`);
              return;
            }
            const len = Number(r.headers.get('content-length') || 0);
            if (len > MAX_ASSET_BYTES) {
              logger.debug(`  [DOM ASSET SKIP] ${absUrl} - too large (${(len / 1024 / 1024).toFixed(1)}MB > ${(MAX_ASSET_BYTES / 1024 / 1024).toFixed(0)}MB)`);
              return;
            }
            const buf = Buffer.from(await r.arrayBuffer());
            await saveAsset(absUrl, buf, contentType);
          } else {
            logger.debug(`  [DOM ASSET MISSING] ${absUrl} -> skipped`);
            failedAssets.add(absUrl);
          }
        } catch (err) {
          logger.debug(`  [DOM ASSET ERR] ${u}: ${(err as Error).message}`);
          try { failedAssets.add(new URL(u, pageUrl).href); } catch { /* ignore */ }
        }
      });
    }
  }

  // Extract inline <style> CSS urls so we can also download those assets
  const inlineStyleUrls = await page.evaluate(() => {
    const urls: string[] = [];
    document.querySelectorAll('style').forEach((el) => {
      const matches = el.textContent?.matchAll(/url\(['"]?([^'")\s]+)['"]?\)/g) ?? [];
      for (const m of matches) urls.push(m[1]);
    });
    document.querySelectorAll('[style]').forEach((el) => {
      const style = el.getAttribute('style') ?? '';
      const matches = style.matchAll(/url\(['"]?([^'")\s]+)['"]?\)/g);
      for (const m of matches) urls.push(m[1]);
    });
    return urls;
  }).catch((err) => {
    logger.debug(`  [INLINE CSS WARN] ${(err as Error).message}`);
    return [] as string[];
  });

  if (inlineStyleUrls.length > 0) {
    logger.debug(`  [INLINE CSS] ${inlineStyleUrls.length} url() refs in inline styles`);
  }

  const inlineStyleUrlsToFetch = IS_SERVERLESS ? inlineStyleUrls.slice(0, 20) : inlineStyleUrls;
  for (const u of inlineStyleUrlsToFetch) {
    if (!assetMap.has(u) && !shouldSkipAsset(u) && !ABORT_PATTERNS.some((p) => p.test(u))) {
      pendingAssets.push(async () => {
        try {
          const absUrl = new URL(u, pageUrl).href;
          if (assetMap.has(absUrl)) return;
          const r = await fetch(absUrl, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(IS_SERVERLESS ? 3_000 : 10_000) });
          if (r.ok) {
            const contentType = r.headers.get('content-type') ?? '';
            if (contentType.includes('text/html')) {
              logger.debug(`  [INLINE CSS SKIP] ${absUrl} - document response`);
              return;
            }
            const len = Number(r.headers.get('content-length') || 0);
            if (len > MAX_ASSET_BYTES) {
              logger.debug(`  [INLINE CSS SKIP] ${absUrl} - too large (${(len / 1024 / 1024).toFixed(1)}MB > ${(MAX_ASSET_BYTES / 1024 / 1024).toFixed(0)}MB)`);
              return;
            }
            const buf = Buffer.from(await r.arrayBuffer());
            await saveAsset(absUrl, buf, contentType);
          } else {
            logger.debug(`  [INLINE CSS MISSING] ${absUrl} -> skipped`);
          }
        } catch (err) {
          logger.debug(`  [INLINE CSS ERR] ${u}: ${(err as Error).message}`);
        }
      });
    }
  }

  // Fetch pending CSS-referenced assets in batches to avoid OOM from too many parallel fetches
  const PENDING_BATCH = IS_SERVERLESS ? 4 : 10;
  let failedPending = 0;
  let pendingIndex = 0;
  while (pendingIndex < pendingAssets.length) {
    const batch = pendingAssets.slice(pendingIndex, pendingIndex + PENDING_BATCH);
    pendingIndex += batch.length;
    const settled = await Promise.allSettled(batch.map((fn) => fn()));
    failedPending += settled.filter((r) => r.status === 'rejected').length;
  }
  if (failedPending > 0) {
    logger.debug(`  [PENDING] ${failedPending}/${pendingAssets.length} pending asset fetches failed`);
  }

  // Post-process: rewrite url() references in all captured CSS files now that assetMap is complete
  let cssRewritten = 0;
  let cssUrlsReplaced = 0;
  for (const [, { localPath, cssText, sourceUrl }] of cssFilesForRewrite) {
    try {
      const rewritten = rewriteCssUrls(cssText, assetMap, sourceUrl);
      if (rewritten !== cssText) {
        writeFileSync(localPath, rewritten, 'utf8');
        cssRewritten++;
        // Count replacements roughly
        const origMatches = (cssText.match(/url\(/g) ?? []).length;
        const newMatches = (rewritten.match(/url\(\/_assets\//g) ?? []).length;
        cssUrlsReplaced += newMatches;
        logger.debug(`  [CSS REWRITE] ${sourceUrl}: ${newMatches}/${origMatches} url() refs rewritten`);
      }
    } catch (err) {
      logger.debug(`  [CSS REWRITE ERR] ${sourceUrl}: ${(err as Error).message}`);
    }
  }

  // -- Interaction pass: click tabs/accordions/nav to surface more API calls ----
  if (!IS_SERVERLESS) try {
    const interactiveSelectors = [
      '[role="tab"]',
      '[data-toggle]',
      '[data-tab]',
      '[data-panel]',
      'details > summary',
      '.tab, .tabs__item, .tab-link, .nav-tab',
      '[aria-controls]',
    ];
    const clickTargets = await page.evaluate((selectors: string[]) => {
      const MAX = 10;
      const seen = new Set<string>();
      const results: Array<{ selector: string; idx: number; text: string }> = [];
      for (const sel of selectors) {
        if (results.length >= MAX) break;
        const els = [...document.querySelectorAll<HTMLElement>(sel)].slice(0, 4);
        els.forEach((el, idx) => {
          const key = sel + '__' + idx;
          if (seen.has(key)) return;
          seen.add(key);
          results.push({ selector: sel, idx, text: el.textContent?.trim().slice(0, 30) ?? '' });
        });
      }
      return results.slice(0, MAX);
    }, interactiveSelectors);

    if (clickTargets.length > 0) {
      logger.debug(`  [INTERACT] Clicking ${clickTargets.length} interactive element(s) to surface API calls`);
      for (const target of clickTargets) {
        try {
          const el = await page.locator(`${target.selector}`).nth(target.idx);
          await el.click({ timeout: 2000, force: true });
          await page.waitForTimeout(300);
        } catch { /* click may fail on hidden/stale element */ }
      }
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    }
  } catch { /* interaction pass is best-effort */ }

  // Final networkidle wait after scroll + interaction
  await page.waitForLoadState('networkidle', { timeout: IS_SERVERLESS ? 1_000 : 8_000 }).catch(() => {});

  // Two-pass: if a pageerror caused by CMS JSON was detected on the first load,
  // reload the page now that those URLs are stubbed as {} so the JS doesn't crash
  // and the HTML snapshot reflects a clean render.
  if (!IS_SERVERLESS && cmsJsonStubs.size > 0) {
    logger.debug(`  [TWO-PASS] ${cmsJsonStubs.size} CMS JSON stub(s) detected; reloading for clean snapshot`);
    try {
      await page.goto(pageUrl, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT });
      await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.debug(`  [TWO-PASS WARN] ${msg}`);
    }
  }

  const html = await page.content();

  // Extract real page links, including SPA routes recorded from pushState/replaceState.
  const origin = new URL(pageUrl).origin;
  const rawLinks = await page.evaluate((origin: string) => {
    const found = new Set<string>();
    const push = (value: string | null | undefined) => {
      if (!value) return;
      try {
        const href = new URL(value, window.location.href).href;
        if (href.startsWith(origin)) found.add(href);
      } catch {
        // Ignore invalid route-like values.
      }
    };

    document.querySelectorAll('a[href]').forEach((a) => push((a as HTMLAnchorElement).href));
    document.querySelectorAll('[href],[to],[routerlink],[data-href],[data-url],[data-link],[data-route],[data-page]').forEach((el) => {
      for (const attr of ['href', 'to', 'routerlink', 'data-href', 'data-url', 'data-link', 'data-route', 'data-page']) {
        const val = el.getAttribute(attr);
        if (val?.startsWith('/') || val?.startsWith(origin)) push(val);
      }
    });

    document.querySelectorAll('link[rel][href]').forEach((el) => {
      const rel = (el.getAttribute('rel') ?? '').toLowerCase();
      if (/(canonical|alternate|next|prev)/.test(rel)) push(el.getAttribute('href'));
    });

    document.querySelectorAll('meta[property="og:url"],meta[name="twitter:url"]').forEach((el) => {
      push(el.getAttribute('content'));
    });

    const spaNavs = (window as Window & { __clonyfyNavs?: string[] }).__clonyfyNavs ?? [];
    spaNavs.forEach(push);

    return [...found];
  }, origin).catch((err) => {
    logger.debug(`  [LINKS WARN] ${(err as Error).message}`);
    return [] as string[];
  });
  const links = rawLinks
    .map((link) => normalizePageUrl(link, pageUrl))
    .filter((link): link is string => !!link && new URL(link).origin === origin);

  const seenPaths = new Set<string>();
  const assets: AssetEntry[] = Array.from(assetMap.entries())
    .filter(([, localPath]) => {
      if (seenPaths.has(localPath)) return false;
      seenPaths.add(localPath);
      return true;
    })
    .map(([originalUrl, localPath]) => ({ originalUrl, localPath }));

  const route = (() => {
    try { return new URL(pageUrl).pathname || '/'; } catch { return '/'; }
  })();

  if (consoleErrors.length > 0) {
    networkLog.push({
      method: 'CONSOLE_ERROR',
      url: pageUrl,
      postData: null,
      status: 0,
      contentType: 'text/plain',
      body: consoleErrors.join('\n'),
    });
  }

  logger.debug(
    `  [PAGE DONE] ${pageUrl}\n` +
    `    network=${networkRequests} intercepted=${assetsIntercepted} saved=${assetsSaved} skipped=${assetsSkipped}\n` +
    `    css_files=${cssFilesForRewrite.size} css_rewritten=${cssRewritten} css_urls_fixed=${cssUrlsReplaced}\n` +
    `    links_found=${links.length} console_errors=${consoleErrors.length}`,
  );

  return {
    record: { url: pageUrl, route, html, assets, network: networkLog, failedAssets: [...failedAssets] },
    links: [...new Set(links)],
  };

  } finally {
    await page.close().catch(() => {}); // safe even if context was already closed externally
  }
}
