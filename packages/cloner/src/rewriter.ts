import * as parse5 from 'parse5';
import { rewriteCssUrls } from './capture.js';
import { logger } from './logger.js';
import type { PageRecord, AssetEntry } from './types.js';

function buildAssetMap(assets: AssetEntry[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of assets) {
    m.set(a.originalUrl, a.localPath);
    m.set(a.originalUrl.split('?')[0].split('#')[0], a.localPath);
  }
  return m;
}

function rewriteUrl(value: string, assetMap: Map<string, string>, origin: string): string {
  if (!value) return value;
  const clean = value.split('?')[0].split('#')[0];

  // Direct lookup (absolute URL already in map)
  if (assetMap.has(value)) return assetMap.get(value)!;
  if (assetMap.has(clean)) return assetMap.get(clean)!;

  // Resolve root-relative and document-relative paths against origin, then look up
  try {
    const abs = new URL(value, origin).href;
    const absClean = abs.split('?')[0].split('#')[0];
    if (assetMap.has(abs)) return assetMap.get(abs)!;
    if (assetMap.has(absClean)) return assetMap.get(absClean)!;
    // Same-origin but not captured as asset — convert to relative path so links still work
    const u = new URL(abs);
    if (u.origin === origin) return u.pathname + u.search + u.hash;
  } catch { /* not a URL */ }

  return value;
}

const URL_ATTRS: Record<string, string[]> = {
  '': ['src', 'href', 'action', 'data-src', 'data-href', 'data-url',
       'data-image', 'data-bg', 'data-background', 'data-video', 'data-poster',
       'poster', 'srcset'],
  'link': ['href'],
  'use': ['href', 'xlink:href'],
  'image': ['href', 'xlink:href'],
};

const META_IMAGE_PROPERTIES = new Set([
  'og:image',
  'og:image:url',
  'og:image:secure_url',
  'twitter:image',
  'twitter:image:src',
]);

// iframe src patterns that should be blanked — map/chat embeds that require live network
const MAP_EMBED_PATTERNS = [
  /openstreetmap\.org\/export\/embed/,
  /maps\.google\.com\/maps/,
  /google\.com\/maps\/embed/,
  /bing\.com\/maps\/embed/,
  /yandex\.\w+\/map-widget/,
  /2gis\.com\/widget/,
  /maps\.apple\.com/,
];
function isMapIframe(src: string): boolean {
  return MAP_EMBED_PATTERNS.some((p) => p.test(src));
}

function isMetaImageContent(el: parse5.DefaultTreeAdapterMap['element']): boolean {
  const key = el.attrs?.find((a) => a.name.toLowerCase() === 'property' || a.name.toLowerCase() === 'name')
    ?.value.toLowerCase();
  return !!key && META_IMAGE_PROPERTIES.has(key);
}

function rewriteAttrValue(
  name: string,
  value: string,
  assetMap: Map<string, string>,
  origin: string,
): string {
  if (!value) return value;

  if (name === 'srcset') {
    return value.split(',').map((part) => {
      const trimmed = part.trim();
      const spaceIdx = trimmed.search(/\s/);
      if (spaceIdx === -1) return rewriteUrl(trimmed, assetMap, origin);
      const url = trimmed.slice(0, spaceIdx);
      const descriptor = trimmed.slice(spaceIdx);
      return rewriteUrl(url, assetMap, origin) + descriptor;
    }).join(', ');
  }

  if (name === 'style') {
    return value.replace(/url\(\s*(['"]?)([^'")\s]+)\1\s*\)/g, (match, quote, url) => {
      const rewritten = rewriteUrl(url, assetMap, origin);
      return `url(${quote}${rewritten}${quote})`;
    });
  }

  return rewriteUrl(value, assetMap, origin);
}

interface RewriteStats {
  attrsRewritten: number;
  attrsToRelative: number;   // same-origin links converted to relative (not assets, just nav links)
  styleUrlsRewritten: number;
  externalUrls: number;      // pointing to other origins — left as-is intentionally
}

function walkNode(
  node: parse5.DefaultTreeAdapterMap['childNode'],
  assetMap: Map<string, string>,
  origin: string,
  stats: RewriteStats,
  failedAssets: Set<string>,
): void {
  if (node.nodeName === '#text' || node.nodeName === '#comment' || node.nodeName === '#document') return;

  const el = node as parse5.DefaultTreeAdapterMap['element'];
  const tagName = el.nodeName?.toLowerCase() ?? '';

  // Blank out map service iframes so they don't make live network requests in the clone
  if (tagName === 'iframe' && el.attrs) {
    const srcAttr = el.attrs.find((a) => a.name === 'src');
    if (srcAttr?.value && isMapIframe(srcAttr.value)) {
      const originalSrc = srcAttr.value;
      srcAttr.value = 'about:blank';
      el.attrs = el.attrs.filter((a) => a.name !== 'allowfullscreen' && a.name !== 'loading');
      logger.debug(`  [MAP IFRAME] replaced ${originalSrc} with about:blank`);
      stats.attrsRewritten++;
    }
  }

  if (tagName === 'style' && el.childNodes) {
    for (const child of el.childNodes) {
      if (child.nodeName === '#text') {
        const textNode = child as parse5.DefaultTreeAdapterMap['textNode'];
        const before = textNode.value;
        textNode.value = rewriteCssUrls(before, assetMap);
        if (textNode.value !== before) stats.styleUrlsRewritten++;
      }
    }
  }

  if (el.attrs) {
    const urlAttrs = new Set([
      ...(URL_ATTRS[''] ?? []),
      ...(URL_ATTRS[tagName] ?? []),
    ]);
    if (tagName === 'meta' && isMetaImageContent(el)) {
      urlAttrs.add('content');
    }

    for (const attr of el.attrs) {
      const attrName = attr.name.toLowerCase();
      if (urlAttrs.has(attrName) && attr.value) {
        const before = attr.value;

        // Strip src/href pointing to assets we know returned 404 during capture.
        // This avoids broken-image network errors when the clone is viewed.
        try {
          const absUrl = new URL(before, origin).href;
          if (failedAssets.has(absUrl) || failedAssets.has(before)) {
            attr.value = '';
            stats.attrsRewritten++;
            continue;
          }
        } catch { /* not a URL, skip */ }

        attr.value = rewriteAttrValue(attrName, attr.value, assetMap, origin);
        if (attr.value !== before) {
          stats.attrsRewritten++;
        } else {
          try {
            const u = new URL(before, origin);
            if (u.origin !== origin && u.protocol.startsWith('http')) {
              stats.externalUrls++;
            } else if (u.origin === origin) {
              stats.attrsToRelative++;
            }
          } catch { /* not a URL */ }
        }
      }
    }
  }

  if ('childNodes' in el && el.childNodes) {
    for (const child of el.childNodes) {
      walkNode(child, assetMap, origin, stats, failedAssets);
    }
  }
}

export function rewriteHtml(record: PageRecord, origin: string): string {
  const assetMap = buildAssetMap(record.assets);
  const failedAssets = new Set<string>(record.failedAssets ?? []);
  const stats: RewriteStats = { attrsRewritten: 0, attrsToRelative: 0, styleUrlsRewritten: 0, externalUrls: 0 };

  const doc = parse5.parse(record.html);
  for (const child of doc.childNodes) {
    walkNode(child, assetMap, origin, stats, failedAssets);
  }

  logger.debug(
    `  [REWRITE] ${record.url}\n` +
    `    attrs_rewritten_to_assets=${stats.attrsRewritten}  style_blocks_rewritten=${stats.styleUrlsRewritten}\n` +
    `    attrs_converted_to_relative=${stats.attrsToRelative}  external_urls_unchanged=${stats.externalUrls}`,
  );

  return parse5.serialize(doc);
}
