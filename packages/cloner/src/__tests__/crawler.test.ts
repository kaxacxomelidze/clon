import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { shouldUseBundledChromium, systemBrowserChannel } from '../crawler.js';

let tempDir = '';

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = '';
});

function tempFile() {
  tempDir = mkdtempSync(join(tmpdir(), 'clonyfy-browser-'));
  const file = join(tempDir, 'chromium');
  writeFileSync(file, '');
  return file;
}

describe('shouldUseBundledChromium', () => {
  it('uses bundled Chromium in serverless environments', () => {
    expect(shouldUseBundledChromium('/missing/chromium', 'linux', true)).toBe(true);
  });

  it('uses bundled Chromium on Linux when the Playwright browser is missing', () => {
    expect(shouldUseBundledChromium('/missing/chromium', 'linux', false)).toBe(true);
  });

  it('uses Playwright Chromium on Linux when the executable exists', () => {
    expect(shouldUseBundledChromium(tempFile(), 'linux', false)).toBe(false);
  });

  it('does not use the Linux bundled Chromium on Windows development machines', () => {
    expect(shouldUseBundledChromium('/missing/chromium.exe', 'win32', false)).toBe(false);
  });
});

describe('systemBrowserChannel', () => {
  it('uses Edge on Windows when Playwright Chromium is missing', () => {
    expect(systemBrowserChannel('/missing/chromium.exe', 'win32', false)).toBe('msedge');
  });

  it('does not use a system browser in serverless environments', () => {
    expect(systemBrowserChannel('/missing/chromium', 'linux', true)).toBeUndefined();
  });

  it('does not use a system browser when Playwright Chromium exists', () => {
    expect(systemBrowserChannel(tempFile(), 'win32', false)).toBeUndefined();
  });
});
