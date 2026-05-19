import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { isServerlessRuntime, shouldUseBundledChromium, systemBrowserChannel } from '../crawler.js';

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

describe('isServerlessRuntime', () => {
  it('detects Vercel runtime markers', () => {
    expect(isServerlessRuntime({ VERCEL: '1' }, '/repo')).toBe(true);
    expect(isServerlessRuntime({ VERCEL_ENV: 'production' }, '/repo')).toBe(true);
    expect(isServerlessRuntime({ CLONYFY_SERVERLESS: '1' }, '/repo')).toBe(true);
  });

  it('detects Lambda runtime markers', () => {
    expect(isServerlessRuntime({ AWS_LAMBDA_FUNCTION_NAME: 'api' }, '/repo')).toBe(true);
    expect(isServerlessRuntime({ LAMBDA_TASK_ROOT: '/var/task' }, '/repo')).toBe(true);
  });

  it('detects bundled serverless task paths', () => {
    expect(isServerlessRuntime({}, '/var/task')).toBe(true);
    expect(isServerlessRuntime({}, '/var/task/packages/cloner')).toBe(true);
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
