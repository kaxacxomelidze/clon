import { describe, it, expect } from 'vitest';
import { rewriteHtml } from '../rewriter.js';
import type { PageRecord } from '../types.js';

const ORIGIN = 'https://example.com';

function record(overrides: Partial<PageRecord> = {}): PageRecord {
  return {
    url: `${ORIGIN}/`,
    route: '/',
    html: '<!doctype html><html><head></head><body></body></html>',
    assets: [],
    network: [],
    failedAssets: [],
    ...overrides,
  };
}

describe('rewriteHtml — <base> tag removal', () => {
  it('removes <base> tags entirely', () => {
    const html = `<html><head><base href="https://example.com/"></head><body></body></html>`;
    const out = rewriteHtml(record({ html }), ORIGIN);
    expect(out).not.toContain('<base');
  });

  it('removes <base> with subdirectory href', () => {
    const html = `<html><head><base href="https://example.com/app/"></head><body></body></html>`;
    const out = rewriteHtml(record({ html }), ORIGIN);
    expect(out).not.toContain('<base');
  });

  it('removes self-closing <base />', () => {
    const html = `<html><head><base href="https://example.com/" /></head><body></body></html>`;
    const out = rewriteHtml(record({ html }), ORIGIN);
    expect(out).not.toContain('<base');
  });
});

describe('rewriteHtml — CSP meta tag removal', () => {
  it('removes Content-Security-Policy meta with double-quoted http-equiv', () => {
    const html = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'"></head><body></body></html>`;
    const out = rewriteHtml(record({ html }), ORIGIN);
    expect(out).not.toMatch(/content-security-policy/i);
  });

  it('removes CSP meta with single-quoted http-equiv', () => {
    const html = `<html><head><meta http-equiv='content-security-policy' content="script-src 'self'"></head><body></body></html>`;
    const out = rewriteHtml(record({ html }), ORIGIN);
    expect(out).not.toMatch(/content-security-policy/i);
  });

  it('does not remove non-CSP meta tags', () => {
    const html = `<html><head><meta charset="UTF-8"><meta name="description" content="test"></head><body></body></html>`;
    const out = rewriteHtml(record({ html }), ORIGIN);
    expect(out).toContain('charset="UTF-8"');
    expect(out).toContain('description');
  });
});

describe('rewriteHtml — asset URL rewriting', () => {
  it('rewrites <img src> to /_assets/ path', () => {
    const html = `<html><head></head><body><img src="https://example.com/photo.jpg"></body></html>`;
    const out = rewriteHtml(record({
      html,
      assets: [{ originalUrl: 'https://example.com/photo.jpg', localPath: '/_assets/abc123.jpg' }],
    }), ORIGIN);
    expect(out).toContain('/_assets/abc123.jpg');
    expect(out).not.toContain('https://example.com/photo.jpg');
  });

  it('rewrites <link href> stylesheet to /_assets/ path', () => {
    const html = `<html><head><link rel="stylesheet" href="https://example.com/styles.css"></head><body></body></html>`;
    const out = rewriteHtml(record({
      html,
      assets: [{ originalUrl: 'https://example.com/styles.css', localPath: '/_assets/def456.css' }],
    }), ORIGIN);
    expect(out).toContain('/_assets/def456.css');
  });

  it('removes SRI integrity attribute when rewriting to local asset', () => {
    const html = `<html><head><link rel="stylesheet" href="https://example.com/styles.css" integrity="sha256-abc123="></head><body></body></html>`;
    const out = rewriteHtml(record({
      html,
      assets: [{ originalUrl: 'https://example.com/styles.css', localPath: '/_assets/def456.css' }],
    }), ORIGIN);
    expect(out).not.toContain('integrity=');
  });

  it('converts same-origin links to root-relative paths', () => {
    const html = `<html><head></head><body><a href="https://example.com/about">About</a></body></html>`;
    const out = rewriteHtml(record({ html }), ORIGIN);
    expect(out).toContain('href="/about"');
    expect(out).not.toContain('https://example.com/about');
  });

  it('leaves external links unchanged', () => {
    const html = `<html><head></head><body><a href="https://other.com/page">External</a></body></html>`;
    const out = rewriteHtml(record({ html }), ORIGIN);
    expect(out).toContain('https://other.com/page');
  });

  it('rewrites srcset attribute correctly', () => {
    const html = `<html><head></head><body><img srcset="https://example.com/img-1x.jpg 1x, https://example.com/img-2x.jpg 2x"></body></html>`;
    const out = rewriteHtml(record({
      html,
      assets: [
        { originalUrl: 'https://example.com/img-1x.jpg', localPath: '/_assets/img1.jpg' },
        { originalUrl: 'https://example.com/img-2x.jpg', localPath: '/_assets/img2.jpg' },
      ],
    }), ORIGIN);
    expect(out).toContain('/_assets/img1.jpg 1x');
    expect(out).toContain('/_assets/img2.jpg 2x');
  });

  it('strips src for known-failed assets', () => {
    const html = `<html><head></head><body><img src="https://example.com/broken.jpg"></body></html>`;
    const out = rewriteHtml(record({
      html,
      failedAssets: ['https://example.com/broken.jpg'],
    }), ORIGIN);
    // src should be emptied
    expect(out).not.toContain('broken.jpg');
  });

  it('rewrites inline style url() references', () => {
    const html = `<html><head></head><body><div style="background:url('https://example.com/bg.jpg')"></div></body></html>`;
    const out = rewriteHtml(record({
      html,
      assets: [{ originalUrl: 'https://example.com/bg.jpg', localPath: '/_assets/bg123.jpg' }],
    }), ORIGIN);
    expect(out).toContain('/_assets/bg123.jpg');
  });

  it('rewrites url() references in <style> blocks', () => {
    const html = `<html><head><style>.hero{background:url('https://example.com/hero.jpg')}</style></head><body></body></html>`;
    const out = rewriteHtml(record({
      html,
      assets: [{ originalUrl: 'https://example.com/hero.jpg', localPath: '/_assets/hero.jpg' }],
    }), ORIGIN);
    expect(out).toContain('/_assets/hero.jpg');
  });

  it('blanks out map iframe srcs', () => {
    const html = `<html><head></head><body><iframe src="https://maps.google.com/maps?q=test"></iframe></body></html>`;
    const out = rewriteHtml(record({ html }), ORIGIN);
    expect(out).toContain('about:blank');
    expect(out).not.toContain('maps.google.com');
  });
});
