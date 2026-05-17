import { createServer } from 'http';
import { spawn } from 'child_process';
import { randomUUID, createHash } from 'crypto';
import { resolve, join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, rmSync, createReadStream, copyFileSync } from 'fs';
import { request as httpsRequest } from 'https';
import { createRequire } from 'module';
import 'dotenv/config';
import {
  getUserById, getUserByEmail, getAllUsers, insertUser, updateUser, deleteUser,
  getUserByVerifyToken, getUserByResetToken,
  getUserByGoogleId, getUserByStripeCustomerId, insertOAuthUser,
  getSession, insertSession, deleteSession, deleteUserSessions, cleanExpiredSessions,
  insertClone, updateCloneLabel, updateCloneStatus, getClonesByUser, getAllClones, deleteCloneById, deleteUserClones, getCloneCountThisMonth,
  getAllPayments, getPaymentsByUser, getPaymentById, insertPayment, updatePayment, getPendingPaymentByUserPlan,
  getSettings, saveSettings,
  getShare, insertShare,
  getAllPromoCodes, getPromoCode, insertPromoCode, incrementPromoUsed, deletePromoCode,
  getAllErrors, insertError, deleteError, clearErrors, pruneErrors,
  insertAudit, getAuditLog, getAuditCount, audit,
  insertAnnouncement, getAllAnnouncements,
  getCloneByOutDir, uploadCloneFile, downloadCloneFile, saveCloneTextFile, getCloneTextFile,
} from './db.js';

const _cjsRequire = createRequire(import.meta.url);
let bcrypt = null, nodemailer = null, StripeLib = null;
try { bcrypt = _cjsRequire('bcryptjs'); } catch {}
try { nodemailer = _cjsRequire('nodemailer'); } catch {}
try { StripeLib = _cjsRequire('stripe'); } catch {}

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, 'packages', 'cloner', 'dist', 'cli.js');
const EMAILS_DIR = join(__dirname, 'templates', 'emails');
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;
const DEFAULT_APP_URL = (process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') || `http://localhost:${PORT}`).replace(/\/$/, '');

const jobs = new Map();

// ── Admin ─────────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const adminSessions = new Map(); // token → expiresAt

function isAdmin(req) {
  const t = req.headers['x-admin-token'] || '';
  if (!t) return false;
  const exp = adminSessions.get(t);
  if (!exp) return false;
  if (Date.now() > exp) { adminSessions.delete(t); return false; }
  return true;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of adminSessions) { if (now > v) adminSessions.delete(k); } }, 3600000);

// ── Rate limiting ──────────────────────────────────────────────────────────────
const rateLimits = new Map();
function checkRateLimit(key, maxReq = 10, windowMs = 60000) {
  const now = Date.now();
  let rl = rateLimits.get(key);
  if (!rl || now > rl.resetAt) { rl = { count: 0, resetAt: now + windowMs }; }
  rl.count++;
  rateLimits.set(key, rl);
  return rl.count <= maxReq;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of rateLimits) { if (now > v.resetAt) rateLimits.delete(k); } }, 300000);
setInterval(async () => { try { await cleanExpiredSessions(Date.now()); } catch {} }, 3600000);

// ── Plan limits ────────────────────────────────────────────────────────────────
const PLAN_LIMITS = {
  free:       { clonesPerMonth: 3,        maxPages: 20  },
  starter:    { clonesPerMonth: 15,       maxPages: 30  },
  popular:    { clonesPerMonth: 50,       maxPages: 100 },
  growth:     { clonesPerMonth: 100,      maxPages: 200 },
  unlimited:  { clonesPerMonth: Infinity, maxPages: 500 },
  pro:        { clonesPerMonth: 100,      maxPages: 200 },
  enterprise: { clonesPerMonth: Infinity, maxPages: 500 },
};
const PAID_PLAN_KEYS = ['starter', 'popular', 'growth', 'unlimited'];
const LEGACY_PAID_PLAN_KEYS = ['pro', 'enterprise'];
const ALL_PAID_PLAN_KEYS = [...PAID_PLAN_KEYS, ...LEGACY_PAID_PLAN_KEYS];
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const SERVERLESS_MAX_PAGES = 20;
const PLAN_PRICES = {
  starter:    { monthly: 9.99,  annual: 95.88  },
  popular:    { monthly: 19.99, annual: 191.88 },
  growth:     { monthly: 34.99, annual: 335.88 },
  unlimited:  { monthly: 59.99, annual: 575.88 },
  pro:        { monthly: 34.99, annual: 335.88 },
  enterprise: { monthly: 59.99, annual: 575.88 },
};
const PLAN_LABELS = {
  starter: 'Starter',
  popular: 'Most Popular',
  growth: 'Growth',
  unlimited: 'Unlimited',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

// ── Auth ──────────────────────────────────────────────────────────────────────
function hashPassword(password, salt) {
  return createHash('sha256').update(salt + password + 'wc_secret_2025').digest('hex');
}
async function hashPw(password) {
  if (bcrypt) return { hash: await bcrypt.hash(password, 12), salt: null };
  const salt = randomUUID().replace(/-/g, '');
  return { hash: hashPassword(password, salt), salt };
}
async function verifyPw(password, user) {
  const h = user.hash || '';
  if (h.startsWith('$2b$') || h.startsWith('$2a$')) {
    return bcrypt ? bcrypt.compare(password, h) : false;
  }
  return h === hashPassword(password, user.salt || '');
}

async function getSessionUser(req) {
  const token = req.headers['x-auth-token'] || '';
  if (!token) return null;
  const session = await getSession(token);
  if (!session) return null;
  if (Date.now() > session.expires_at) {
    await deleteSession(token);
    return null;
  }
  const user = await getUserById(session.user_id);
  if (!user) return null;
  user._sessionToken = token;
  user._impersonatedBy = session.impersonated_by || null;
  return user;
}

// ── Settings cache ────────────────────────────────────────────────────────────
const SETTINGS_DEFAULTS = {
  btc:'', eth:'', usdt_trc20:'', paypal_email:'', paypal_me:'', app_note:'',
  smtp_host:'', smtp_port:'587', smtp_user:'', smtp_pass:'', smtp_from:'',
  smtp_secure: false, app_url: DEFAULT_APP_URL, support_email:'',
};
let _settingsCache = { ...SETTINGS_DEFAULTS };
async function initSettings() { _settingsCache = await getSettings(); }
const getCachedSettings = () => _settingsCache;
const invalidateSettingsCache = async () => { _settingsCache = await getSettings(); };

function publicAppUrl(req = null) {
  const configured = String(getCachedSettings().app_url || '').replace(/\/$/, '');
  if (configured && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)) return configured;
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  if (host) {
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
    const firstHost = String(host).split(',')[0].trim();
    if (firstHost) return `${proto}://${firstHost}`.replace(/\/$/, '');
  }
  return configured || DEFAULT_APP_URL;
}

// ── Email templates ───────────────────────────────────────────────────────────
const _emailTemplateCache = new Map();
function renderEmail(templateName, vars) {
  const s = getCachedSettings();
  const appUrl = (s.app_url || `http://localhost:${PORT}`).replace(/\/$/, '');
  const host = (() => { try { return new URL(appUrl).host; } catch { return appUrl; } })();
  const base = {
    APP_URL: appUrl,
    APP_HOST: host,
    SUPPORT_EMAIL: s.support_email || s.smtp_from || `support@${host}`,
    YEAR: new Date().getFullYear(),
    SUBJECT: vars.SUBJECT || 'CLONYFY',
    ...vars,
  };

  const contentPath = join(EMAILS_DIR, `${templateName}.html`);
  const basePath = join(EMAILS_DIR, '_base.html');

  let content = _emailTemplateCache.get(contentPath);
  if (!content) {
    try { content = readFileSync(contentPath, 'utf8'); } catch { content = `<p>{{SUBJECT}}</p>`; }
    _emailTemplateCache.set(contentPath, content);
  }
  let baseHtml = _emailTemplateCache.get(basePath);
  if (!baseHtml) {
    try { baseHtml = readFileSync(basePath, 'utf8'); } catch { baseHtml = '{{CONTENT}}'; }
    _emailTemplateCache.set(basePath, baseHtml);
  }

  const fill = (tpl, data) => tpl.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) =>
    data[k] !== undefined ? htmlEsc(String(data[k])) : '');

  const filledContent = fill(content, base);
  return fill(baseHtml.replace('{{CONTENT}}', filledContent), base);
}

// ── Stripe ────────────────────────────────────────────────────────────────────
let _stripeInstance = null, _stripeKey = '';
function getStripe() {
  const s = getStripeSettings();
  const key = s.stripe_secret_key || '';
  if (!key || !StripeLib) return null;
  if (_stripeInstance && _stripeKey === key) return _stripeInstance;
  const Ctor = StripeLib.default || StripeLib;
  _stripeInstance = new Ctor(key, { apiVersion: '2024-06-20' });
  _stripeKey = key;
  return _stripeInstance;
}
function stripeUnavailableReason() {
  const s = getStripeSettings();
  if (!StripeLib) return 'Stripe package is not installed on the server.';
  if (!s.stripe_secret_key) return 'Missing STRIPE_SECRET_KEY environment variable or admin Stripe Secret Key.';
  return '';
}

// Map of plan+interval → settings key for Stripe price IDs
const STRIPE_PRICE_KEY = (plan, interval) => `stripe_price_${plan}_${interval}`;
const STRIPE_PRICE_ENV_KEY = (plan, interval) => `STRIPE_PRICE_${plan}_${interval}`.toUpperCase();
const SECRET_MASK = '••••••••';
function isMaskedSecret(value) {
  const v = String(value || '').trim();
  return v === SECRET_MASK || /^â€¢+$/.test(v);
}
function envFirst(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return String(value).trim();
  }
  return '';
}
function getStripeSettings(raw = getCachedSettings()) {
  const out = { ...raw };
  out.stripe_secret_key = String(raw.stripe_secret_key || '').trim() || envFirst('STRIPE_SECRET_KEY', 'STRIPE_SECRET', 'STRIPE_SK', 'STRIPE_PRIVATE_KEY');
  out.stripe_webhook_secret = String(raw.stripe_webhook_secret || '').trim() || envFirst('STRIPE_WEBHOOK_SECRET');
  out.stripe_publishable_key = String(raw.stripe_publishable_key || '').trim() || envFirst('STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_PK');
  for (const plan of ALL_PAID_PLAN_KEYS) {
    for (const interval of ['monthly', 'annual']) {
      const key = STRIPE_PRICE_KEY(plan, interval);
      out[key] = String(raw[key] || '').trim() || envFirst(STRIPE_PRICE_ENV_KEY(plan, interval));
    }
  }
  return out;
}
function stripePeriodEnd(sub) {
  return sub?.current_period_end || sub?.items?.data?.[0]?.current_period_end || null;
}
async function ensureStripePrice(stripe, plan, interval) {
  const s = getStripeSettings();
  const key = STRIPE_PRICE_KEY(plan, interval);
  if (s[key]) return s[key];
  const amount = PLAN_PRICES[plan]?.[interval];
  if (!amount) throw new Error(`No local price exists for ${plan} ${interval}.`);

  const product = await stripe.products.create({
    name: `CLONYFY ${PLAN_LABELS[plan] || plan}`,
    metadata: { app: 'clonyfy', plan },
  });
  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: Math.round(amount * 100),
    recurring: { interval: interval === 'annual' ? 'year' : 'month' },
    product: product.id,
    metadata: { app: 'clonyfy', plan, billing_interval: interval },
  });

  try {
    const current = { ...getCachedSettings(), [key]: price.id };
    await saveSettings(current);
    await invalidateSettingsCache();
  } catch (err) {
    console.warn('[Stripe] created price but could not save setting:', err.message);
  }
  return price.id;
}

// ── Google OAuth state ────────────────────────────────────────────────────────
const _oauthStates = new Map(); // state → expiresAt
setInterval(() => { const now = Date.now(); for (const [k, v] of _oauthStates) if (now > v) _oauthStates.delete(k); }, 300000);

// ── Email ─────────────────────────────────────────────────────────────────────
let _mailerTransport = null;
let _mailerKey = '';
async function sendEmail(to, subject, html) {
  const s = getCachedSettings();
  if (!s.smtp_host || !nodemailer) {
    console.log(`\n[Email → ${to}]\nSubject: ${subject}\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n`);
    return;
  }
  const key = `${s.smtp_host}:${s.smtp_port}:${s.smtp_user}:${s.smtp_pass}:${s.smtp_secure}`;
  if (!_mailerTransport || key !== _mailerKey) {
    _mailerTransport = nodemailer.createTransport({
      host: s.smtp_host,
      port: parseInt(s.smtp_port, 10) || 587,
      secure: s.smtp_secure === true || s.smtp_secure === '1' || s.smtp_secure === 'true' || s.smtp_port === '465',
      auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
    });
    _mailerKey = key;
  }
  try {
    await _mailerTransport.sendMail({ from: s.smtp_from || s.smtp_user || 'noreply@clonyfy.app', to, subject, html });
  } catch(err) {
    console.error('[Email error]', err.message);
    _mailerTransport = null; // force recreate on next send
  }
}

// ── Dunning / subscription expiry ─────────────────────────────────────────────
async function runDunning() {
  try {
    const users = await getAllUsers();
    const now = Date.now();
    const s = getCachedSettings();
    const appUrl = s.app_url || `http://localhost:${PORT}`;
    for (const u of users) {
      if (!u.plan_renews_at || u.plan === 'free') continue;
      const renewsAt = new Date(u.plan_renews_at).getTime();
      if (now < renewsAt) continue;
      const graceEnd = renewsAt + 7 * 24 * 3600 * 1000;
      if (!u.renewal_reminder_sent) {
        await updateUser(u.id, { renewal_reminder_sent: 1 });
        sendEmail(u.email, 'Your CLONYFY subscription has expired',
          renderEmail('renewal-reminder', { SUBJECT: 'Your subscription has expired', NAME: u.name, PLAN: u.plan, EXPIRED_AT: new Date(renewsAt).toLocaleDateString() })
        ).catch(() => {});
      }
      if (u.cancel_at_period_end || now > graceEnd) {
        await updateUser(u.id, { plan: 'free', plan_renews_at: null, cancel_at_period_end: 0, renewal_reminder_sent: 0, usage_alert_sent: 0 });
        sendEmail(u.email, 'Your account has been downgraded to Free',
          renderEmail('downgraded', { SUBJECT: 'Account downgraded to Free', NAME: u.name })
        ).catch(() => {});
      }
    }
  } catch(err) {
    console.error('[Dunning error]', err.message);
  }
}

// ── Usage alerts ──────────────────────────────────────────────────────────────
async function checkUsageAlert(userId) {
  try {
    const user = await getUserById(userId);
    if (!user || user.plan === 'free' || user.usage_alert_sent) return;
    const plan = user.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    if (limits.clonesPerMonth === Infinity) return;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const used = await getCloneCountThisMonth(userId, monthStart.toISOString());
    const pct = used / limits.clonesPerMonth;
    if (pct >= 0.8) {
      await await updateUser(userId, { usage_alert_sent: 1 });
      const s = getCachedSettings();
      const appUrl = s.app_url || `http://localhost:${PORT}`;
      sendEmail(user.email, "You've used 80% of your monthly clone quota",
        renderEmail('usage-alert', { SUBJECT: "You've used 80% of your quota", NAME: user.name, USED: String(used), LIMIT: String(limits.clonesPerMonth), PCT: String(Math.round(pct * 100)) })
      ).catch(() => {});
    }
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const OUTPUT_DIR = process.env.VERCEL ? join('/tmp', 'output') : join(__dirname, 'output');

const _fileCache = new Map();
function serveFile(res, filePath, contentType, cacheSecs = 0) {
  try {
    let data = _fileCache.get(filePath);
    if (!data) {
      data = readFileSync(filePath);
      if (cacheSecs > 0) _fileCache.set(filePath, data);
    }
    const headers = { 'Content-Type': contentType };
    if (cacheSecs > 0) headers['Cache-Control'] = `public, max-age=${cacheSecs}`;
    res.writeHead(200, headers);
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function isInsideOutputDir(candidate) {
  const base = resolve(OUTPUT_DIR);
  const resolved = resolve(candidate || '');
  return resolved === base || resolved.startsWith(base + '\\') || resolved.startsWith(base + '/');
}

function cloneStoragePrefix(outDir) {
  return createHash('sha1').update(String(outDir || '')).digest('hex').slice(0, 24);
}

function cloneStoragePath(outDir, relPath) {
  return `${cloneStoragePrefix(outDir)}/${String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '')}`;
}

function cloneFileListStoragePath(outDir) {
  return cloneStoragePath(outDir, '__files.json');
}

function contentTypeForPath(filePath) {
  const ext = filePath.match(/\.\w+$/)?.[0]?.toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avif': 'image/avif',
  }[ext] || 'application/octet-stream';
}

async function persistCloneOutput(outDir) {
  if (!isInsideOutputDir(outDir) || !existsSync(outDir)) return;
  const files = [];
  const addFile = (rel) => {
    const abs = join(outDir, rel);
    if (existsSync(abs) && statSync(abs).isFile()) files.push({ rel: rel.replace(/\\/g, '/'), abs });
  };
  addFile('route-map.json');
  const walk = (baseRel) => {
    const baseAbs = join(outDir, baseRel);
    if (!existsSync(baseAbs)) return;
    for (const entry of readdirSync(baseAbs, { withFileTypes: true })) {
      const rel = join(baseRel, entry.name);
      const abs = join(outDir, rel);
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile()) files.push({ rel: rel.replace(/\\/g, '/'), abs });
    }
  };
  walk('captured-pages');
  walk(join('public', '_assets'));

  let uploaded = 0;
  let fallbackSaved = 0;
  const failures = [];
  const uploadOne = async (file) => {
    const size = statSync(file.abs).size;
    if (size > 50 * 1024 * 1024) return;
    const storagePath = cloneStoragePath(outDir, file.rel);
    const data = readFileSync(file.abs);
    try {
      await uploadCloneFile(storagePath, data, contentTypeForPath(file.rel));
      uploaded++;
    } catch (err) {
      failures.push(`${file.rel}: ${err?.message || err}`);
      if (file.rel === 'route-map.json' || file.rel.startsWith('captured-pages/')) {
        try {
          await saveCloneTextFile(storagePath, data.toString('utf8'));
          fallbackSaved++;
        } catch (fallbackErr) {
          failures.push(`${file.rel} fallback: ${fallbackErr?.message || fallbackErr}`);
        }
      }
    }
  };
  const runLimited = async (items, limit = 8) => {
    for (let i = 0; i < items.length; i += limit) {
      await Promise.all(items.slice(i, i + limit).map(uploadOne));
    }
  };

  const criticalFiles = files.filter(file => file.rel === 'route-map.json' || file.rel.startsWith('captured-pages/'));
  const assetFiles = files.filter(file => !criticalFiles.includes(file));
  await runLimited(criticalFiles, 8);
  try {
    await saveCloneTextFile(cloneFileListStoragePath(outDir), JSON.stringify(criticalFiles.map(file => ({
      rel: file.rel,
      size: statSync(file.abs).size,
      contentType: contentTypeForPath(file.rel),
    }))));
  } catch (err) {
    failures.push(`__files.json critical: ${err?.message || err}`);
  }
  await runLimited(assetFiles, 8);
  try {
    await saveCloneTextFile(cloneFileListStoragePath(outDir), JSON.stringify(files.map(file => ({
      rel: file.rel,
      size: statSync(file.abs).size,
      contentType: contentTypeForPath(file.rel),
    }))));
  } catch (err) {
    failures.push(`__files.json: ${err?.message || err}`);
  }
  console.log(`[clone storage] uploaded ${uploaded}/${files.length} files, fallback=${fallbackSaved} for ${outDir}`);
  if (failures.length) console.warn(`[clone storage] ${failures.slice(0, 5).join(' | ')}`);
}

async function readCloneFile(outDir, relPath) {
  const localPath = join(outDir, relPath);
  if (isInsideOutputDir(localPath) && existsSync(localPath)) return readFileSync(localPath);
  const storagePath = cloneStoragePath(outDir, relPath);
  const stored = await downloadCloneFile(storagePath);
  if (stored) return stored;
  if (relPath === 'route-map.json' || String(relPath).replace(/\\/g, '/').startsWith('captured-pages/')) {
    const text = await getCloneTextFile(storagePath);
    if (text != null) return Buffer.from(text, 'utf8');
  }
  return null;
}

async function writeCloneFile(outDir, relPath, bytes, contentType = contentTypeForPath(relPath)) {
  const normalized = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes ?? ''), 'utf8');
  if (!normalized || normalized.includes('..')) throw new Error('Invalid clone file path');
  const localPath = join(outDir, normalized);
  if (isInsideOutputDir(localPath) && existsSync(outDir)) {
    mkdirSync(dirname(localPath), { recursive: true });
    writeFileSync(localPath, buffer);
  }
  const storagePath = cloneStoragePath(outDir, normalized);
  try {
    await uploadCloneFile(storagePath, buffer, contentType);
  } catch {
    if (contentType.startsWith('text/') || contentType.includes('json')) {
      await saveCloneTextFile(storagePath, buffer.toString('utf8'));
    } else {
      throw new Error('Could not persist clone file');
    }
  }
  const files = await readPersistedCloneFileList(outDir);
  const next = files.filter(f => f.rel !== normalized);
  next.push({ rel: normalized, size: buffer.length, contentType });
  await saveCloneTextFile(cloneFileListStoragePath(outDir), JSON.stringify(next));
}

function jobStoragePath(id) {
  return `job:${id}`;
}

function jobSnapshot(job) {
  return {
    ...job,
    logs: Array.isArray(job.logs) ? job.logs.slice(-500) : [],
  };
}

function persistJob(job) {
  saveCloneTextFile(jobStoragePath(job.id), JSON.stringify(jobSnapshot(job))).catch(() => {});
}

async function readPersistedJob(id) {
  const raw = await getCloneTextFile(jobStoragePath(id)).catch(() => null);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function readPersistedCloneFileList(outDir) {
  const raw = await getCloneTextFile(cloneFileListStoragePath(outDir)).catch(() => null);
  if (!raw) {
    const map = await loadRouteMapAsync(outDir);
    if (!map) return [];
    const rels = new Set(['route-map.json']);
    for (const filename of Object.values(map)) {
      if (filename) rels.add(`captured-pages/${String(filename).replace(/\\/g, '/')}`);
    }
    for (const rel of [...rels].filter(r => r.startsWith('captured-pages/'))) {
      const data = await readCloneFile(outDir, rel);
      const html = data ? data.toString('utf8') : '';
      for (const match of html.matchAll(/["'(]\/_assets\/([^"'()?#]+)/g)) {
        try { rels.add(`public/_assets/${decodeURIComponent(match[1])}`); }
        catch { rels.add(`public/_assets/${match[1]}`); }
      }
    }
    return [...rels].map(rel => ({ rel, size: 0, contentType: contentTypeForPath(rel) }));
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(f => f?.rel && !String(f.rel).includes('..')).map(f => ({ ...f, rel: String(f.rel).replace(/\\/g, '/') }))
      : [];
  } catch {
    return [];
  }
}

async function materializeCloneOutput(outDir) {
  if (!isInsideOutputDir(outDir)) throw new Error('Invalid output folder');
  if (existsSync(outDir)) return { dir: outDir, cleanup: () => {} };
  const files = await readPersistedCloneFileList(outDir);
  if (!files.length) throw new Error('Output folder not found');
  const tempDir = join(OUTPUT_DIR, `__materialized_${randomUUID().slice(0, 8)}`);
  mkdirSync(tempDir, { recursive: true });
  try {
    for (const file of files) {
      const rel = String(file.rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (!rel || rel.includes('..')) continue;
      const data = await readCloneFile(outDir, rel);
      if (!data) continue;
      const dest = join(tempDir, rel);
      if (!isInsideOutputDir(dest)) continue;
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, data);
    }
    return {
      dir: tempDir,
      cleanup: () => { try { rmSync(tempDir, { recursive: true, force: true }); } catch {} },
    };
  } catch (err) {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
    throw err;
  }
}

function loadRouteMap(outDir) {
  if (!isInsideOutputDir(outDir)) return null;
  const mapPath = join(outDir, 'route-map.json');
  if (!existsSync(mapPath)) return null;
  try { return JSON.parse(readFileSync(mapPath, 'utf8')); }
  catch { return null; }
}

async function loadRouteMapAsync(outDir) {
  const local = loadRouteMap(outDir);
  if (local) return local;
  if (!isInsideOutputDir(outDir)) return null;
  const data = await readCloneFile(outDir, 'route-map.json');
  if (!data) return null;
  try { return JSON.parse(data.toString('utf8')); }
  catch { return null; }
}

async function verifyCloneReadable(outDir) {
  const map = await loadRouteMapAsync(outDir);
  if (!map || !Object.keys(map).length) return { ok: false, error: 'route-map.json is not readable' };
  for (const filename of Object.values(map)) {
    if (!filename) return { ok: false, error: 'A captured route has no page file' };
    const page = await readCloneFile(outDir, join('captured-pages', filename));
    if (!page || !page.length) return { ok: false, error: `Captured page missing: ${filename}` };
  }
  return { ok: true, pages: Object.keys(map).length };
}

function rewritePreviewAssetUrls(html, outDir) {
  const prefix = `/api/asset?outDir=${encodeURIComponent(outDir)}&path=`;
  return String(html).replace(/(["'(])\/_assets\//g, (_, lead) => `${lead}${prefix}${encodeURIComponent('_assets/')}`);
}

function htmlEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function routeFilename(route) {
  if (route === '/') return '__home__.html';
  return `${route.replace(/^\/+/, '').replace(/[^a-z0-9]+/gi, '_') || 'page'}.html`;
}

function authPageHtml(siteName, kind) {
  const isRegister = kind === 'register';
  const title = isRegister ? 'Create account' : 'Sign in';
  const subtitle = isRegister ? `Start using ${siteName}` : `Welcome back to ${siteName}`;
  const altHref = isRegister ? '/login' : '/register';
  const altText = isRegister ? 'Already have an account? Sign in' : 'Need an account? Register';
  const fields = isRegister
    ? '<label>Full name<input name="name" autocomplete="name" placeholder="Jane Doe" required></label>'
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEsc(title)} | ${htmlEsc(siteName)}</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;background:#f5f7fb;color:#111827;display:grid;place-items:center;padding:24px}.auth-shell{width:min(100%,420px);background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 18px 55px rgba(15,23,42,.12);padding:32px}.brand{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#2563eb;margin-bottom:22px}h1{font-size:30px;line-height:1.1;margin:0 0 8px}p{margin:0 0 24px;color:#6b7280;line-height:1.6}form{display:grid;gap:14px}label{display:grid;gap:7px;font-size:13px;font-weight:700;color:#374151}input{height:44px;border:1px solid #d1d5db;border-radius:6px;padding:0 12px;font:inherit;color:#111827;background:#fff}input:focus{outline:3px solid rgba(37,99,235,.16);border-color:#2563eb}button{height:46px;border:0;border-radius:6px;background:#2563eb;color:#fff;font:inherit;font-weight:800;cursor:pointer;margin-top:4px}button:hover{background:#1d4ed8}.alt{display:block;margin-top:18px;color:#2563eb;text-decoration:none;font-size:14px;font-weight:700}.fine{font-size:12px;color:#9ca3af;margin-top:18px;margin-bottom:0}</style>
</head><body><main class="auth-shell"><div class="brand">${htmlEsc(siteName)}</div><h1>${htmlEsc(title)}</h1><p>${htmlEsc(subtitle)}</p><form>${fields}<label>Email<input type="email" name="email" autocomplete="email" placeholder="you@example.com" required></label><label>Password<input type="password" name="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" placeholder="********" required></label><button type="submit">${htmlEsc(title)}</button></form><a class="alt" href="${altHref}">${htmlEsc(altText)}</a><p class="fine">This generated auth page is ready to connect to your real backend.</p></main></body></html>`;
}

function writeAuthPage(outDir, kind) {
  const map = loadRouteMap(outDir);
  if (!map) throw new Error('No generated site found');
  const route = kind === 'register' ? '/register' : '/login';
  const filename = map[route] || routeFilename(route);
  const pagesDir = join(outDir, 'captured-pages');
  const htmlPath = join(pagesDir, filename);
  if (!isInsideOutputDir(htmlPath)) throw new Error('Invalid page path');
  mkdirSync(pagesDir, { recursive: true });
  writeFileSync(htmlPath, authPageHtml(outDir.split(/[\\/]/).pop() || 'site', kind), 'utf8');
  map[route] = filename;
  writeFileSync(join(outDir, 'route-map.json'), JSON.stringify(map, null, 2), 'utf8');
  return { route, filename };
}

function readJsonBody(req, limitBytes = 100_000) {
  return new Promise((resolveBody, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (c) => {
      size += Buffer.byteLength(c);
      if (size > limitBytes) { req.destroy(); reject(new Error('request too large')); return; }
      body += c;
    });
    req.on('end', () => {
      try { resolveBody(JSON.parse(body || '{}')); }
      catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

function readRawBody(req, limitBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limitBytes) { req.destroy(); reject(new Error('too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function extensionForAsset(filename, mimeType) {
  const ext = String(filename || '').match(/\.[a-z0-9]{1,8}$/i)?.[0];
  if (ext) return ext.toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('svg')) return '.svg';
  return '.bin';
}

let _outputsCache = null;
let _outputsCacheAt = 0;
function getOutputs(maxAgeMs = 2000) {
  const now = Date.now();
  if (_outputsCache && now - _outputsCacheAt < maxAgeMs) return _outputsCache;
  if (!existsSync(OUTPUT_DIR)) { _outputsCache = []; _outputsCacheAt = now; return []; }
  _outputsCache = readdirSync(OUTPUT_DIR)
    .map((name) => {
      const dir = join(OUTPUT_DIR, name);
      try {
        const stat = statSync(dir);
        if (!stat.isDirectory()) return null;
        const manifestPath = join(dir, 'manifest.json');
        const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
        return { name, dir, targetOrigin: manifest?.targetOrigin ?? '', capturedAt: manifest?.capturedAt ?? stat.mtime.toISOString() };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  _outputsCacheAt = now;
  return _outputsCache;
}
function invalidateOutputsCache() { _outputsCache = null; }

function sharePasswordFormHtml(shareId, error) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Protected Preview</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#07071a;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;color:#e8e8ff}.card{background:#0c0c1c;border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:40px 36px;width:min(400px,92vw)}.logo{width:150px;height:auto;display:block;margin-bottom:28px}.kicker{font-size:11px;font-weight:700;color:rgba(255,255,255,.28);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px}h2{font-size:22px;font-weight:800;margin:0 0 6px;letter-spacing:-.4px}p{margin:0 0 24px;color:rgba(255,255,255,.3);font-size:13px}.err{color:#e05070;font-size:12px;background:rgba(255,69,96,.07);border:1px solid rgba(255,69,96,.15);border-radius:8px;padding:10px 14px;margin-bottom:14px}input{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#e8e8ff;font-size:14px;padding:12px 16px;outline:none;font-family:inherit;margin-bottom:14px}input:focus{border-color:rgba(91,141,239,.45)}button{width:100%;padding:13px;background:linear-gradient(135deg,#5b8def,#a855f7);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}</style></head><body><div class="card"><img class="logo" src="/brand-wordmark.svg" alt="CLONYFY"><div class="kicker">Protected preview</div><h2>Password required</h2><p>This preview is password protected.</p>${error ? `<div class="err">${htmlEsc(error)}</div>` : ''}<form method="post" action="/share/${htmlEsc(shareId)}"><input type="password" name="pw" placeholder="Enter password" autofocus required><button type="submit">View Preview</button></form></div></body></html>`;
}

function userPublic(u) {
  return {
    id: u.id, name: u.name, email: u.email,
    plan: u.plan || 'free',
    planRenewsAt: u.plan_renews_at || null,
    billingInterval: u.billing_interval || 'monthly',
    emailVerified: u.email_verified === 1 || u.email_verified === true,
    cancelAtPeriodEnd: u.cancel_at_period_end === 1,
    createdAt: u.created_at,
  };
}

// ── Request handler ────────────────────────────────────────────────────────────

// Returns true if the given outDir was created by (and belongs to) this user.
// Checks both in-memory running jobs and persisted DB clones so newly-started
// jobs (not yet written to the DB) still pass the ownership check.
async function userOwnsOutDir(user, outDir) {
  if (!outDir) return false;
  for (const job of jobs.values()) {
    if (job.userId === user.id && job.outDir === outDir) return true;
  }
  const clones = await getClonesByUser(user.id);
  return clones.some(c => c.out_dir === outDir);
}

async function canReadOutDir(user, outDir) {
  if (!outDir) return false;
  if (user) return userOwnsOutDir(user, outDir);
  for (const job of jobs.values()) {
    if (job.userId === null && job.outDir === outDir) return true;
  }
  const clone = await getCloneByOutDir(outDir).catch(() => null);
  if (clone && clone.user_id == null) return true;
  return false;
}

async function canReadCloneRecord(user, outDir) {
  if (!outDir) return false;
  const clone = await getCloneByOutDir(outDir).catch(() => null);
  if (!clone) return false;
  if (!clone.user_id) return true;
  return !!user && (clone.user_id === user.id || user.role === 'admin');
}

async function canUseCloneOutput(user, outDir) {
  if (!user || !outDir) return false;
  if (await userOwnsOutDir(user, outDir)) return true;
  return canReadCloneRecord(user, outDir);
}

function netlifyAPIRequest(method, path, token, body, contentType) {
  return new Promise((resolve, reject) => {
    const isBuffer = Buffer.isBuffer(body);
    const opts = {
      hostname: 'api.netlify.com', port: 443, path, method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
        'Content-Length': isBuffer ? body.length : Buffer.byteLength(body),
      },
    };
    const req = httpsRequest(opts, (r) => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => {
        try { resolve({ status: r.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { resolve({ status: r.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function runProcess(file, args, opts = {}) {
  return new Promise((resolvePromise, reject) => {
    const p = spawn(file, args, { stdio: 'ignore', ...opts });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolvePromise() : reject(new Error(`${file} exited ${code}`)));
  });
}

async function buildOutputZip(outDir) {
  if (!isInsideOutputDir(outDir)) throw new Error('Invalid output folder');
  const materialized = await materializeCloneOutput(outDir);
  const zipName = `${outDir.split(/[\\/]/).pop()}.zip`;
  const zipPath = join(OUTPUT_DIR, zipName);
  try { rmSync(zipPath, { force: true }); } catch {}
  try {
    await runProcess('tar', ['-a', '-c', '-f', zipPath, '-C', materialized.dir, '.']);
  } catch {
    if (process.platform !== 'win32') {
      await runProcess('zip', ['-qr', zipPath, '.'], { cwd: materialized.dir });
    } else {
      await runProcess('powershell', [
        '-NoProfile', '-Command',
        'Get-ChildItem -LiteralPath $args[0] -Force | Compress-Archive -DestinationPath $args[1] -Force',
        materialized.dir, zipPath,
      ]);
    }
  } finally {
    materialized.cleanup();
  }
  if (!existsSync(zipPath)) throw new Error('ZIP was not created');
  return { zipName, zipPath };
}

function githubAPIRequest(method, path, token, body = null) {
  return new Promise((resolvePromise, reject) => {
    const payload = body == null ? null : Buffer.from(JSON.stringify(body));
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'clonyfy',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }
    const req = httpsRequest({ hostname: 'api.github.com', port: 443, path, method, headers }, (r) => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = {};
        try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { message: text }; }
        if (r.statusCode >= 200 && r.statusCode < 300) {
          resolvePromise({ status: r.statusCode, body: parsed });
        } else {
          reject(new Error(parsed.message || `GitHub API HTTP ${r.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function parseGitHubRepo(input) {
  const raw = String(input || '').trim();
  let match = raw.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (!match) match = raw.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
  return { owner, repo };
}

function cleanGitPath(input) {
  const cleaned = String(input || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean);
  if (cleaned.some(part => part === '.' || part === '..')) throw new Error('Invalid GitHub path');
  return cleaned.join('/');
}

function normalizeTargetUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new Error('Enter a website URL');
  if (/^https?:\/\/https?:[/:\\]?/i.test(raw)) throw new Error('Enter one valid website URL');
  raw = raw.replace(/\\/g, '/').replace(/^https?:\/(?!\/)/i, m => m.toLowerCase() + '/');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw.replace(/^\/+/, '');
  const parsed = new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Use an http or https URL');
  if (!parsed.hostname || !parsed.hostname.includes('.') || ['http', 'https'].includes(parsed.hostname.toLowerCase()) || /[/:]/.test(parsed.hostname)) {
    throw new Error('Enter a valid website domain');
  }
  parsed.hash = '';
  return parsed;
}

function listOutputFiles(outDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
        walk(abs);
      } else if (entry.isFile()) {
        const rel = relative(outDir, abs).replace(/\\/g, '/');
        files.push({ abs, rel, size: statSync(abs).size });
      }
    }
  };
  walk(outDir);
  return files;
}

function githubErrorStatus(err) {
  const msg = String(err?.message || '');
  if (/bad credentials|requires authentication/i.test(msg)) return 401;
  if (/not found/i.test(msg)) return 404;
  if (/validation failed|invalid/i.test(msg)) return 400;
  return 502;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const ip = req.socket?.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const reqOrigin = req.headers['origin'] || '';
  res.setHeader('Access-Control-Allow-Origin', reqOrigin || '*');
  if (reqOrigin) res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token, X-CLONYFY-Token, X-Admin-Token');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Static UI files
  if (req.method === 'GET' && url.pathname === '/') {
    return serveFile(res, join(__dirname, 'public', 'landing.html'), 'text/html');
  }
  if (req.method === 'GET' && url.pathname === '/app') {
    return serveFile(res, join(__dirname, 'public', 'index.html'), 'text/html');
  }
  const staticExts = { '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
  const ext = url.pathname.match(/\.\w+$/)?.[0];
  if (ext && staticExts[ext] && !url.pathname.startsWith('/_assets/')) {
    return serveFile(res, join(__dirname, 'public', url.pathname.slice(1)), staticExts[ext], 60);
  }
  if (req.method === 'GET' && url.pathname.startsWith('/_assets/')) {
    const relPath = url.pathname.replace(/^\//, '');
    const mimeMap = {
      '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.ico': 'image/x-icon',
      '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
      '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject', '.mp4': 'video/mp4', '.webm': 'video/webm', '.avif': 'image/avif',
    };
    const assetExt = relPath.match(/\.\w+$/)?.[0]?.toLowerCase();
    const type = mimeMap[assetExt] || 'application/octet-stream';
    const dirsToTry = getOutputs().map(o => o.dir);
    for (const dir of dirsToTry) {
      if (!dir) continue;
      const assetPath = join(dir, 'public', relPath);
      if (isInsideOutputDir(assetPath) && existsSync(assetPath)) return serveFile(res, assetPath, type, 3600);
    }
    res.writeHead(404); res.end(); return;
  }

  if (req.method === 'GET' && url.pathname === '/api/asset') {
    const assetUser = await getSessionUser(req);
    const outDir = url.searchParams.get('outDir') || '';
    const relPath = String(url.searchParams.get('path') || '').replace(/^\/+/, '');
    if (!isInsideOutputDir(outDir) || !relPath.startsWith('_assets/')) return json(res, { error: 'Invalid asset' }, 400);
    const readable = await canReadOutDir(assetUser, outDir) || !!(await getCloneByOutDir(outDir).catch(() => null));
    if (!readable) return json(res, { error: assetUser ? 'Not found' : 'Not authenticated' }, assetUser ? 404 : 401);
    const data = await readCloneFile(outDir, join('public', relPath));
    if (!data) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentTypeForPath(relPath), 'Cache-Control': 'public, max-age=3600' });
    res.end(data);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/outputs') {
    const user = await getSessionUser(req);
    if (!user) return json(res, { error: 'Not authenticated' }, 401);
    const userClones = await getClonesByUser(user.id);
    const labelByDir = Object.fromEntries(userClones.filter(c => c.out_dir && c.label).map(c => [c.out_dir, c.label]));
    const localByDir = Object.fromEntries(getOutputs().map(o => [o.dir, o]));
    const normalized = [];
    for (const c of userClones.filter(c => c.out_dir)) {
      let status = c.status;
      let pages = c.pages;
      if (status === 'done') {
        const readable = await verifyCloneReadable(c.out_dir).catch(err => ({ ok: false, error: err?.message || String(err) }));
        if (!readable.ok) {
          status = 'error';
          pages = 0;
          updateCloneStatus({ id: c.id, status: 'error', pages: 0 }).catch(() => {});
        } else if (readable.pages && readable.pages !== pages) {
          pages = readable.pages;
          updateCloneStatus({ id: c.id, pages }).catch(() => {});
        }
      }
      normalized.push({
      id: c.id,
      name: c.out_dir.split(/[\\/]/).pop(),
      dir: c.out_dir,
      targetOrigin: c.url,
      capturedAt: c.completed_at || c.started_at,
      status,
      pages,
      assets: c.assets,
      apiRoutes: c.api_routes,
      ...(localByDir[c.out_dir] || {}),
      label: labelByDir[c.out_dir] || null,
      });
    }
    return json(res, normalized);
  }
  if (req.method === 'GET' && url.pathname === '/api/jobs') {
    const user = await getSessionUser(req);
    if (!user) return json(res, { error: 'Not authenticated' }, 401);
    return json(res, [...jobs.values()].filter(j => j.userId === user.id));
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    if (!checkRateLimit(`reg:${ip}`, 5, 3600000)) return json(res, { error: 'Too many accounts created from this address. Try again later.' }, 429);
    const body = await readJsonBody(req);
    const { name, email, password } = body;
    if (!name || !email || !password) return json(res, { error: 'Name, email and password are required' }, 400);
    if (password.length < 8) return json(res, { error: 'Password must be at least 8 characters' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, { error: 'Invalid email address' }, 400);
    if (await getUserByEmail(email.toLowerCase().trim())) return json(res, { error: 'An account with this email already exists' }, 409);
    const { hash, salt } = await hashPw(password);
    const user = {
      id: randomUUID(), name: name.trim(), email: email.toLowerCase().trim(),
      hash, salt, verifyToken: null, verifyExpiry: null,
      createdAt: new Date().toISOString(),
    };
    await insertUser(user);
    await updateUser(user.id, { email_verified: 1 });
    const token = randomUUID();
    await insertSession({ token, userId: user.id, createdAt: new Date().toISOString(), expiresAt: Date.now() + 30*24*60*60*1000, impersonatedBy: null });
    audit(user.id, user.name, 'register', null, ip);
    return json(res, { token, user: userPublic(await getUserById(user.id)) });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    if (!checkRateLimit(`login:${ip}`, 10, 300000)) return json(res, { error: 'Too many login attempts. Try again in 5 minutes.' }, 429);
    const body = await readJsonBody(req);
    const { email, password } = body;
    if (!email || !password) return json(res, { error: 'Email and password are required' }, 400);
    const user = await getUserByEmail(email.toLowerCase().trim());
    const ok = user ? await verifyPw(password, user) : false;
    if (!ok) return json(res, { error: 'Invalid email or password' }, 401);
    if (user.blocked) return json(res, { error: 'Your account has been suspended. Contact support.' }, 403);
    if (bcrypt && user.hash && !user.hash.startsWith('$2b$') && !user.hash.startsWith('$2a$')) {
      await updateUser(user.id, { hash: await bcrypt.hash(password, 12), salt: null });
    }
    const token = randomUUID();
    await insertSession({ token, userId: user.id, createdAt: new Date().toISOString(), expiresAt: Date.now() + 30*24*60*60*1000, impersonatedBy: null });
    audit(user.id, user.name, 'login', null, ip);
    return json(res, { token, user: userPublic(await getUserById(user.id)) });
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const user = await getSessionUser(req);
    if (!user) return json(res, { error: 'Not authenticated' }, 401);
    return json(res, { user: userPublic(user) });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = req.headers['x-auth-token'] || '';
    if (token) {
      const session = await getSession(token);
      const user = session ? await getUserById(session.user_id) : null;
      if (user) audit(user.id, user.name, 'logout', null, ip);
      await deleteSession(token);
    }
    return json(res, { ok: true });
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  const TEMPLATES_META = {
    blank:      { name: 'Blank Page',      description: 'Start with a clean white canvas',                    category: 'Basic' },
    landing:    { name: 'SaaS Landing',    description: 'Product page with hero, features, pricing, and CTA', category: 'Marketing' },
    portfolio:  { name: 'Portfolio',       description: 'Showcase your work with a clean minimal design',     category: 'Personal' },
    blog:       { name: 'Blog',            description: 'Clean article layout with sidebar and newsletter',   category: 'Content' },
    business:   { name: 'Business',        description: 'Professional corporate site with services and team', category: 'Business' },
    restaurant: { name: 'Restaurant',      description: 'Elegant dining site with menu and reservations',     category: 'Food' },
    ecommerce:  { name: 'Online Store',    description: 'Product catalog with filters, cart, and promotions', category: 'Store' },
  };

  if (req.method === 'GET' && url.pathname === '/api/templates') {
    return json(res, Object.entries(TEMPLATES_META).map(([id, meta]) => ({ id, ...meta })));
  }

  if (req.method === 'POST' && url.pathname === '/api/create-from-template') {
    const templateUser = await getSessionUser(req);
    if (!templateUser) return json(res, { error: 'Not authenticated' }, 401);
    readJsonBody(req).then(async ({ templateId }) => {
      const safeId = String(templateId || '').replace(/[^a-z0-9-]/gi, '');
      if (!safeId || !TEMPLATES_META[safeId]) return json(res, { error: 'Template not found' }, 404);
      const templateFile = join(__dirname, 'public', 'templates', `${safeId}.html`);
      if (!existsSync(templateFile)) return json(res, { error: 'Template file missing' }, 404);
      const id = randomUUID();
      const outDir = join(OUTPUT_DIR, `builder-${safeId}-${id.slice(0, 6)}`);
      mkdirSync(join(outDir, 'captured-pages'), { recursive: true });
      mkdirSync(join(outDir, 'public', '_assets'), { recursive: true });
      writeFileSync(join(outDir, 'captured-pages', '__home__.html'), readFileSync(templateFile, 'utf8'), 'utf8');
      writeFileSync(join(outDir, 'route-map.json'), JSON.stringify({ '/': '__home__.html' }, null, 2), 'utf8');
      writeAuthPage(outDir, 'login');
      writeAuthPage(outDir, 'register');
      const now = new Date().toISOString();
      writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ targetOrigin: `builder:${safeId}`, capturedAt: now, pages: [] }, null, 2), 'utf8');
      await insertClone({ id, userId: templateUser.id, userName: templateUser.name, url: `builder:${safeId}`, outDir, status: 'completed', pages: 1, assets: 0, apiRoutes: 0, startedAt: now, completedAt: now });
      try { await persistCloneOutput(outDir); } catch {}
      invalidateOutputsCache();
      json(res, { ok: true, outDir });
    }).catch(() => json(res, { error: 'bad json' }, 400));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/pages') {
    const pagesUser = await getSessionUser(req);
    const outDir = url.searchParams.get('outDir');
    if (!outDir) return json(res, []);
    if (!await canReadOutDir(pagesUser, outDir) && !await canReadCloneRecord(pagesUser, outDir)) {
      return json(res, { error: pagesUser ? 'Not found' : 'Not authenticated' }, pagesUser ? 404 : 401);
    }
    const map = await loadRouteMapAsync(outDir);
    if (!map) return json(res, []);
    return json(res, Object.keys(map));
  }

  if (req.method === 'GET' && url.pathname === '/api/page') {
    const pageUser = await getSessionUser(req);
    const outDir = url.searchParams.get('outDir');
    if (!outDir) { res.writeHead(404); res.end('No clone specified'); return; }
    if (!await canReadOutDir(pageUser, outDir) && !await canReadCloneRecord(pageUser, outDir)) {
      if (!pageUser) return json(res, { error: 'Not authenticated' }, 401);
      res.writeHead(404); res.end('Not found'); return;
    }
    const route = url.searchParams.get('route') || '/';
    const map = await loadRouteMapAsync(outDir);
    if (!map) { res.writeHead(404); res.end('No clone loaded'); return; }
    const filename = map[route] || map['/'];
    if (!filename) { res.writeHead(404); res.end('Route not found'); return; }
    const data = await readCloneFile(outDir, join('captured-pages', filename));
    if (!data) { res.writeHead(404); res.end('File missing'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(rewritePreviewAssetUrls(data.toString('utf8'), outDir));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/save-page') {
    const saveUser = await getSessionUser(req);
    if (!saveUser) return json(res, { error: 'Not authenticated' }, 401);
    if ((saveUser.plan || 'free') === 'free') return json(res, { error: 'Visual editor requires a paid plan. Upgrade to edit pages.' }, 403);
    readJsonBody(req).then(async ({ outDir, route, html }) => {
      if (!await canUseCloneOutput(saveUser, outDir)) return json(res, { error: 'Not found' }, 404);
      const map = await loadRouteMapAsync(outDir);
      if (!map) return json(res, { error: 'No clone loaded' }, 404);
      const filename = map[route || '/'];
      if (!filename) return json(res, { error: 'Route not found' }, 404);
      await writeCloneFile(outDir, join('captured-pages', filename), String(html ?? ''), 'text/html; charset=utf-8');
      json(res, { ok: true });
    }).catch(() => json(res, { error: 'bad json' }, 400));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/create-auth-page') {
    const authPageUser = await getSessionUser(req);
    if (!authPageUser) return json(res, { error: 'Not authenticated' }, 401);
    readJsonBody(req).then(async ({ outDir, kind }) => {
      if (!isInsideOutputDir(outDir)) return json(res, { error: 'Invalid output folder' }, 400);
      if (!await canUseCloneOutput(authPageUser, outDir)) return json(res, { error: 'Not found' }, 404);
      const pageKind = kind === 'register' ? 'register' : 'login';
      const map = await loadRouteMapAsync(outDir);
      if (!map) return json(res, { error: 'No clone loaded' }, 404);
      const route = pageKind === 'register' ? '/register' : '/login';
      const filename = routeFilename(route);
      map[route] = filename;
      const html = authPageHtml(outDir.split(/[\\/]/).pop() || 'site', pageKind);
      await writeCloneFile(outDir, join('captured-pages', filename), html, 'text/html; charset=utf-8');
      await writeCloneFile(outDir, 'route-map.json', JSON.stringify(map, null, 2), 'application/json');
      const page = { route, filename };
      json(res, { ok: true, ...page });
    }).catch((err) => json(res, { error: err instanceof Error ? err.message : 'bad json' }, 400));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/import-asset') {
    const assetUser = await getSessionUser(req);
    if (!assetUser) return json(res, { error: 'Not authenticated' }, 401);
    readJsonBody(req).then(async ({ outDir, dataUrl, filename }) => {
      if (!isInsideOutputDir(outDir)) return json(res, { error: 'Invalid output folder' }, 400);
      if (!await canUseCloneOutput(assetUser, outDir)) return json(res, { error: 'Not found' }, 404);
      const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return json(res, { error: 'Invalid file data' }, 400);
      const bytes = Buffer.from(match[2], 'base64');
      if (bytes.length > 50 * 1024 * 1024) return json(res, { error: 'File is larger than 50MB' }, 400);
      const assetsDir = join(outDir, 'public', '_assets');
      if (!isInsideOutputDir(assetsDir)) return json(res, { error: 'Invalid asset path' }, 400);
      const assetName = `user-${randomUUID().slice(0, 8)}${extensionForAsset(filename, match[1])}`;
      await writeCloneFile(outDir, join('public', '_assets', assetName), bytes, match[1]);
      json(res, { ok: true, path: `/_assets/${assetName}`, mimeType: match[1], size: bytes.length });
    }).catch(() => json(res, { error: 'bad json' }, 400));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    const id = url.searchParams.get('id');
    const job = jobs.get(id) || await readPersistedJob(id);
    if (!job) return json(res, { error: 'not found' }, 404);
    const statusUser = await getSessionUser(req);
    const statusUserId = statusUser ? statusUser.id : null;
    if (job.userId !== statusUserId) return json(res, { error: 'not found' }, 404);
    return json(res, job);
  }

  // ── Clone ──────────────────────────────────────────────────────────────────

  if (req.method === 'POST' && url.pathname === '/api/clone') {
    const cloneUser = await getSessionUser(req);
    if (cloneUser && cloneUser.blocked) return json(res, { error: 'Your account has been suspended. Contact support.' }, 403);

    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch { return json(res, { error: 'bad json' }, 400); }
      let target;
      try { target = normalizeTargetUrl(parsed.url); } catch (err) { return json(res, { error: err.message || 'Invalid URL' }, 400); }
      const targetUrl = target.href;
      const { depth = '3', ignoreRobots = false } = parsed;
      let { maxPages = '20' } = parsed;

      if (cloneUser) {
        const plan = cloneUser.plan || 'free';
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
        if (limits.clonesPerMonth !== Infinity) {
          const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
          const used = await getCloneCountThisMonth(cloneUser.id, monthStart.toISOString());
          if (used >= limits.clonesPerMonth) {
            return json(res, { error: `Monthly limit reached (${used}/${limits.clonesPerMonth} for ${plan} plan). Upgrade to clone more.` }, 429);
          }
        }
        maxPages = String(Math.min(parseInt(maxPages, 10) || 20, (PLAN_LIMITS[plan] || PLAN_LIMITS.free).maxPages));
      } else {
        if (!checkRateLimit(`clone_anon:${ip}`, 2, 86400000)) return json(res, { error: 'Rate limit exceeded. Sign in for more clones.' }, 429);
        maxPages = String(Math.min(parseInt(maxPages, 10) || 20, PLAN_LIMITS.free.maxPages));
      }
      if (IS_VERCEL) {
        maxPages = String(Math.min(parseInt(maxPages, 10) || SERVERLESS_MAX_PAGES, SERVERLESS_MAX_PAGES));
      }

      const id = randomUUID();
      const hostname = target.hostname.replace(/\./g, '-');
      const outDir = resolve(OUTPUT_DIR, `${hostname}-${id.slice(0, 6)}`);

      const job = {
        id, url: targetUrl, hostname: target.hostname,
        status: 'running', logs: [], outDir,
        startedAt: new Date().toISOString(),
        pages: null, apiRoutes: null, assets: null,
        userId: cloneUser ? cloneUser.id : null,
        userName: cloneUser ? cloneUser.name : 'Anonymous',
      };
      jobs.set(id, job);
      persistJob(job);
      try {
        await insertClone({
          id: job.id, userId: job.userId, userName: job.userName,
          url: job.url, outDir: job.outDir, status: job.status,
          pages: job.pages, assets: job.assets, apiRoutes: job.apiRoutes,
          startedAt: job.startedAt, completedAt: null,
        });
      } catch (dbErr) {
        job.logs.push(`[WARN] Could not create initial clone record: ${dbErr?.message || dbErr}`);
        persistJob(job);
      }

      if (cloneUser) audit(cloneUser.id, cloneUser.name, 'clone_start', targetUrl, ip);

      const args = ['clone', targetUrl, '--out', outDir, '--max-pages', String(maxPages), '--depth', String(depth), '--concurrency', '1'];
      if (ignoreRobots) args.push('--ignore-robots');

      const proc = spawn(process.execPath, [CLI, ...args], {
        cwd: __dirname,
        env: process.env,
      });
      proc.stdout.on('data', (c) => {
        c.toString().split('\n').filter(Boolean).forEach((l) => job.logs.push(l));
        persistJob(job);
      });
      proc.stderr.on('data', (c) => {
        c.toString().split('\n').filter(Boolean).forEach((l) => job.logs.push(`[ERROR] ${l}`));
        persistJob(job);
      });
      proc.on('close', async (code, signal) => {
        if (code !== 0) {
          job.logs.push(`[ERROR] Clone process exited with code ${code ?? 'null'}${signal ? ` signal ${signal}` : ''}`);
        }
        job.status = code === 0 ? 'saving' : 'error';
        persistJob(job);
        if (code === 0) { invalidateOutputsCache(); }
        const findNum = (pat) => {
          const line = job.logs.find((l) => l.includes(pat));
          if (!line) return null;
          const m = line.match(/:\s*(\d+)/);
          return m ? parseInt(m[1], 10) : null;
        };
        job.pages = findNum('Pages      :') ?? findNum('Pages       :') ?? null;
        job.apiRoutes = findNum('API routes :') ?? findNum('API routes  :') ?? 0;
        job.assets = findNum('Total unique assets saved') ?? findNum('Assets      :') ?? findNum('Assets       :') ?? 0;
        if (job.pages === null) {
          try {
            const pagesDir = join(outDir, 'captured-pages');
            job.pages = existsSync(pagesDir)
              ? readdirSync(pagesDir).filter(f => f.endsWith('.html') && f !== '__login__.html' && f !== '__register__.html').length
              : 0;
          } catch { job.pages = 0; }
        }
        const completedAt = new Date().toISOString();
        let cloneReadable = code !== 0 ? { ok: false, error: 'Clone process failed' } : null;
        if (code === 0) {
          try {
            await persistCloneOutput(job.outDir);
            cloneReadable = await verifyCloneReadable(job.outDir);
            if (!cloneReadable.ok) {
              job.logs.push(`[ERROR] Clone output is not ready for preview: ${cloneReadable.error}`);
            }
          } catch (storageErr) {
            job.logs.push(`[WARN] Could not persist all clone files: ${storageErr?.message || storageErr}`);
            cloneReadable = { ok: false, error: storageErr?.message || String(storageErr) };
          }
        }
        let cloneRecordSaved = false;
        try {
          await insertClone({
            id: job.id, userId: job.userId, userName: job.userName,
            url: job.url, outDir: job.outDir, status: code === 0 && cloneReadable?.ok ? 'done' : 'error',
            pages: job.pages, assets: job.assets, apiRoutes: job.apiRoutes,
            startedAt: job.startedAt, completedAt,
          });
          cloneRecordSaved = true;
        } catch (dbErr) {
          job.logs.push(`[ERROR] Could not save clone record: ${dbErr?.message || dbErr}`);
        }
        if (code === 0) job.status = cloneRecordSaved && cloneReadable?.ok ? 'done' : 'error';
        persistJob(job);
        if (code !== 0) {
          try {
            const errorLines = job.logs.filter(l => l.startsWith('[ERROR]') || l.toLowerCase().includes('error'));
            await insertError({
              id: job.id, userId: job.userId, userName: job.userName,
              url: job.url, errorSummary: errorLines[0] || job.logs[job.logs.length - 1] || 'Unknown error',
              logs: JSON.stringify(job.logs.slice(-100)),
              startedAt: job.startedAt, failedAt: completedAt,
            });
            await pruneErrors();
          } catch {}
        }
        if (cloneUser) {
          audit(cloneUser.id, cloneUser.name, code === 0 ? 'clone_complete' : 'clone_error', `${targetUrl} pages=${job.pages}`, ip);
          if (code === 0) {
            checkUsageAlert(cloneUser.id);
            const s = getCachedSettings();
            const appUrl = (s.app_url || `http://localhost:${PORT}`).replace(/\/$/, '');
            sendEmail(cloneUser.email, `Clone complete — ${new URL(targetUrl).hostname}`,
              renderEmail('clone-complete', {
                SUBJECT: `Clone complete — ${new URL(targetUrl).hostname}`,
                NAME: cloneUser.name,
                SITE: new URL(targetUrl).hostname,
                PAGES: String(job.pages ?? 0),
                LINK: appUrl + '/app',
              })
            ).catch(() => {});
          }
        }
      });

      return json(res, job);
    });
    return;
  }

  // ── Clone rename ─────────────────────────────────────────────────────────
  if (req.method === 'PATCH' && url.pathname.startsWith('/api/clones/')) {
    const renameUser = await getSessionUser(req);
    if (!renameUser) return json(res, { error: 'Not authenticated' }, 401);
    const cloneId = url.pathname.slice('/api/clones/'.length);
    const { label } = await readJsonBody(req);
    if (!cloneId) return json(res, { error: 'Missing id' }, 400);
    const job = jobs.get(cloneId);
    let owns = job ? (job.userId === renameUser.id || renameUser.role === 'admin') : false;
    if (!owns && !job) {
      const clones = await getClonesByUser(renameUser.id);
      owns = clones.some(c => c.id === cloneId) || renameUser.role === 'admin';
    }
    if (!owns) return json(res, { error: 'Not found' }, 404);
    const safe = String(label || '').trim().slice(0, 80);
    await updateCloneLabel({ id: cloneId, label: safe || null });
    if (job) job.label = safe || null;
    return json(res, { ok: true, label: safe || null });
  }

  // ── Preview / export / delete ─────────────────────────────────────────────

  if (req.method === 'POST' && url.pathname === '/api/preview') {
    const previewUser = await getSessionUser(req);
    if (!previewUser) return json(res, { error: 'Not authenticated' }, 401);
    const { outDir } = await readJsonBody(req);
    if (!isInsideOutputDir(outDir)) return json(res, { error: 'Invalid output folder' }, 400);
    if (!await canUseCloneOutput(previewUser, outDir)) return json(res, { error: 'Not found' }, 404);
    if (IS_VERCEL) {
      const map = await loadRouteMapAsync(outDir);
      if (!map) return json(res, { error: 'Preview pages not found' }, 404);
      return json(res, {
        ok: true,
        url: `/api/page?outDir=${encodeURIComponent(outDir)}&route=${encodeURIComponent('/')}`,
        hosted: true,
      });
    }
    if (!existsSync(outDir)) return json(res, { error: 'Output folder not found' }, 404);
    try {
      const needsInstall = !existsSync(join(outDir, 'node_modules'));
      const cmd = needsInstall ? 'npm install && npm run dev' : 'npm run dev';
      const proc = spawn(cmd, [], { cwd: outDir, shell: true, detached: true, stdio: 'ignore' });
      proc.unref();
      return json(res, { ok: true, url: 'http://localhost:3000' });
    } catch(err) { return json(res, { error: err.message }, 500); }
  }

  if (req.method === 'POST' && url.pathname === '/api/export-zip') {
    const zipUser = await getSessionUser(req);
    if (!zipUser) return json(res, { error: 'Not authenticated' }, 401);
    if ((zipUser.plan || 'free') === 'free') return json(res, { error: 'Export requires a paid plan. Upgrade to download your clones.' }, 403);
    const { outDir } = await readJsonBody(req);
    if (!isInsideOutputDir(outDir)) return json(res, { error: 'Invalid output folder' }, 400);
    if (!await canUseCloneOutput(zipUser, outDir)) return json(res, { error: 'Not found' }, 404);
    try {
      const { zipName, zipPath } = await buildOutputZip(outDir);
      return json(res, { ok: true, zipPath, folder: OUTPUT_DIR });
    } catch(err) { return json(res, { error: err.message }, 500); }
  }

  if (req.method === 'GET' && url.pathname === '/api/download-zip') {
    const dlUser = await getSessionUser(req);
    if (!dlUser) return json(res, { error: 'Not authenticated' }, 401);
    if ((dlUser.plan || 'free') === 'free') return json(res, { error: 'Export requires a paid plan. Upgrade to download your clones.' }, 403);
    const outDir = url.searchParams.get('outDir') || '';
    if (!isInsideOutputDir(outDir)) return json(res, { error: 'Invalid output folder' }, 400);
    if (!await canUseCloneOutput(dlUser, outDir)) return json(res, { error: 'Not found' }, 404);
    try {
      const { zipName, zipPath } = await buildOutputZip(outDir);
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Content-Length': statSync(zipPath).size,
      });
      const stream = createReadStream(zipPath);
      stream.pipe(res);
      stream.on('close', () => { try { rmSync(zipPath); } catch {} });
    } catch(err) { return json(res, { error: err.message }, 500); }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/github/connect') {
    const ghUser = await getSessionUser(req);
    if (!ghUser) return json(res, { error: 'Not authenticated' }, 401);
    if ((ghUser.plan || 'free') === 'free') return json(res, { error: 'GitHub push requires a paid plan. Upgrade to publish your clones.' }, 403);
    try {
      const { token } = await readJsonBody(req, 50_000);
      if (!token || String(token).length < 20) return json(res, { error: 'GitHub token is required' }, 400);
      const me = await githubAPIRequest('GET', '/user', token);
      const reposResp = await githubAPIRequest('GET', '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member', token);
      const repos = (reposResp.body || [])
        .filter(r => r?.permissions?.push || r?.permissions?.admin || r?.permissions?.maintain)
        .map(r => ({
          fullName: r.full_name,
          defaultBranch: r.default_branch || 'main',
          private: !!r.private,
          htmlUrl: r.html_url,
          pushedAt: r.pushed_at,
        }));
      return json(res, {
        ok: true,
        user: { login: me.body.login, name: me.body.name || me.body.login, avatarUrl: me.body.avatar_url },
        repos,
      });
    } catch(err) {
      return json(res, { error: err.message }, githubErrorStatus(err));
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/github/branches') {
    const ghUser = await getSessionUser(req);
    if (!ghUser) return json(res, { error: 'Not authenticated' }, 401);
    if ((ghUser.plan || 'free') === 'free') return json(res, { error: 'GitHub push requires a paid plan. Upgrade to publish your clones.' }, 403);
    try {
      const { token, repo } = await readJsonBody(req, 50_000);
      if (!token || String(token).length < 20) return json(res, { error: 'GitHub token is required' }, 400);
      const parsedRepo = parseGitHubRepo(repo);
      if (!parsedRepo) return json(res, { error: 'Enter a GitHub repo as owner/repo or a github.com URL' }, 400);
      const { owner, repo: repoName } = parsedRepo;
      const branches = await githubAPIRequest('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/branches?per_page=100`, token);
      return json(res, {
        ok: true,
        branches: (branches.body || []).map(b => b.name).filter(Boolean),
      });
    } catch(err) {
      return json(res, { error: err.message }, githubErrorStatus(err));
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/github/push') {
    const ghUser = await getSessionUser(req);
    if (!ghUser) return json(res, { error: 'Not authenticated' }, 401);
    if ((ghUser.plan || 'free') === 'free') return json(res, { error: 'GitHub push requires a paid plan. Upgrade to publish your clones.' }, 403);
    try {
      const { outDir, token, repo, branch = 'main', targetPath = '', commitMessage = '', cleanTarget = false } = await readJsonBody(req, 200_000);
      if (!isInsideOutputDir(outDir)) return json(res, { error: 'Invalid output folder' }, 400);
      if (!await canUseCloneOutput(ghUser, outDir)) return json(res, { error: 'Not found' }, 404);
      if (!token || String(token).length < 20) return json(res, { error: 'GitHub token is required' }, 400);
      const parsedRepo = parseGitHubRepo(repo);
      if (!parsedRepo) return json(res, { error: 'Enter a GitHub repo as owner/repo or a github.com URL' }, 400);
      const cleanBranch = String(branch || 'main').trim();
      if (!/^[A-Za-z0-9._/-]+$/.test(cleanBranch) || cleanBranch.includes('..')) return json(res, { error: 'Invalid branch name' }, 400);
      const materialized = await materializeCloneOutput(outDir);
      try {
        const prefix = cleanGitPath(targetPath);
        const files = listOutputFiles(materialized.dir);
        if (!files.length) return json(res, { error: 'No files found in output folder' }, 400);
        if (files.length > 5000) return json(res, { error: `Too many files for one GitHub commit (${files.length}/5000). Try a smaller clone.` }, 400);
        const tooLarge = files.find(f => f.size > 95 * 1024 * 1024);
        if (tooLarge) return json(res, { error: `File is too large for GitHub API: ${tooLarge.rel}` }, 400);

        const { owner, repo: repoName } = parsedRepo;
        const refPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/ref/heads/${cleanBranch.split('/').map(encodeURIComponent).join('/')}`;
        const repoInfo = await githubAPIRequest('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`, token);
        let ref;
        try {
          ref = await githubAPIRequest('GET', refPath, token);
        } catch {
          const defaultBranch = repoInfo.body.default_branch || 'main';
          const defaultRef = await githubAPIRequest('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/ref/heads/${encodeURIComponent(defaultBranch)}`, token);
          await githubAPIRequest('POST', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/refs`, token, {
            ref: `refs/heads/${cleanBranch}`,
            sha: defaultRef.body.object.sha,
          });
          ref = await githubAPIRequest('GET', refPath, token);
        }

        const baseCommitSha = ref.body.object.sha;
        const baseCommit = await githubAPIRequest('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/commits/${baseCommitSha}`, token);
        const baseTreeSha = baseCommit.body.tree.sha;
        const entries = [];
        const nextPaths = new Set();
        for (const file of files) {
          const gitPath = prefix ? `${prefix}/${file.rel}` : file.rel;
          nextPaths.add(gitPath);
          const blob = await githubAPIRequest('POST', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/blobs`, token, {
            content: readFileSync(file.abs).toString('base64'),
            encoding: 'base64',
          });
          entries.push({ path: gitPath, mode: '100644', type: 'blob', sha: blob.body.sha });
        }

        if (cleanTarget) {
          const tree = await githubAPIRequest('GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/trees/${baseTreeSha}?recursive=1`, token);
          for (const item of tree.body.tree || []) {
            if (item.type !== 'blob') continue;
            const inTarget = prefix ? item.path === prefix || item.path.startsWith(`${prefix}/`) : true;
            if (inTarget && !nextPaths.has(item.path)) {
              entries.push({ path: item.path, mode: '100644', type: 'blob', sha: null });
            }
          }
        }

        const newTree = await githubAPIRequest('POST', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/trees`, token, {
          base_tree: baseTreeSha,
          tree: entries,
        });
        const message = String(commitMessage || '').trim() || `Import CLONYFY output (${outDir.split(/[\\/]/).pop()})`;
        const commit = await githubAPIRequest('POST', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/commits`, token, {
          message,
          tree: newTree.body.sha,
          parents: [baseCommitSha],
        });
        await githubAPIRequest('PATCH', refPath, token, { sha: commit.body.sha, force: false });
        return json(res, {
          ok: true,
          files: files.length,
          branch: cleanBranch,
          targetPath: prefix,
          commitUrl: commit.body.html_url,
          repoUrl: repoInfo.body.html_url,
        });
      } finally {
        materialized.cleanup();
      }
    } catch(err) {
      return json(res, { error: err.message }, githubErrorStatus(err));
    }
  }

  if (req.method === 'DELETE' && url.pathname === '/api/output') {
    const deleteUser = await getSessionUser(req);
    if (!deleteUser) return json(res, { error: 'Not authenticated' }, 401);
    const { outDir } = await readJsonBody(req);
    if (!isInsideOutputDir(outDir)) return json(res, { error: 'Invalid output folder' }, 400);
    if (!await canUseCloneOutput(deleteUser, outDir)) return json(res, { error: 'Not found' }, 404);
    try {
      if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
      for (const [id, job] of jobs.entries()) {
        if (job.outDir === outDir) jobs.delete(id);
      }
      const clone = await getCloneByOutDir(outDir).catch(() => null);
      if (clone?.id) await deleteCloneById(clone.id);
      return json(res, { ok: true });
    } catch(err) { return json(res, { error: err.message }, 500); }
  }

  // ── Shares ─────────────────────────────────────────────────────────────────

  if (req.method === 'POST' && url.pathname === '/api/share/create') {
    const shareUser = await getSessionUser(req);
    if (!shareUser) return json(res, { error: 'Not authenticated' }, 401);
    if ((shareUser.plan || 'free') === 'free') return json(res, { error: 'Share links require a paid plan. Upgrade to share your clones.' }, 403);
    const { outDir, route, password, expiresInDays } = await readJsonBody(req);
    if (!isInsideOutputDir(outDir)) return json(res, { error: 'Invalid output folder' }, 400);
    if (!await canUseCloneOutput(shareUser, outDir)) return json(res, { error: 'Not found' }, 404);
    const map = await loadRouteMapAsync(outDir);
    if (!map) return json(res, { error: 'No clone found' }, 404);
    const shareId = randomUUID().replace(/-/g, '').slice(0, 14);
    let passwordHash = null, salt = null;
    if (password) {
      salt = randomUUID();
      passwordHash = createHash('sha256').update(salt + password + 'wc_share_2025').digest('hex');
    }
    const expiresAt = expiresInDays ? Date.now() + Number(expiresInDays) * 86400000 : null;
    await insertShare({ id: shareId, outDir, route: route || '/', createdAt: new Date().toISOString(), passwordHash, salt, expiresAt });
    const _appUrl = publicAppUrl(req);
    return json(res, { shareId, url: `${_appUrl}/share/${shareId}` });
  }

  if ((req.method === 'GET' || req.method === 'POST') && url.pathname.startsWith('/share/')) {
    const shareId = url.pathname.slice(7).split('/')[0].replace(/[^a-z0-9]/gi, '');
    const share = await getShare(shareId);
    if (!share) { res.writeHead(404, {'Content-Type':'text/html'}); res.end('<h2 style="font-family:system-ui;padding:40px">Share link not found or expired.</h2>'); return; }
    if (share.expires_at && Date.now() > share.expires_at) { res.writeHead(410, {'Content-Type':'text/html'}); res.end('<h2 style="font-family:system-ui;padding:40px">This share link has expired.</h2>'); return; }
    if (share.password_hash) {
      let pw = '';
      if (req.method === 'POST') {
        // Read password from POST body (form-encoded or JSON)
        const rawBody = await new Promise((ok, fail) => {
          let b = ''; let sz = 0;
          req.on('data', (c) => { sz += Buffer.byteLength(c); if (sz > 4096) { req.destroy(); } else { b += c; } });
          req.on('end', () => ok(b));
          req.on('error', fail);
        });
        const ct = req.headers['content-type'] || '';
        if (ct.includes('application/x-www-form-urlencoded')) {
          pw = new URLSearchParams(rawBody).get('pw') || '';
        } else {
          try { pw = JSON.parse(rawBody).pw || ''; } catch { /* ignore */ }
        }
      }
      if (!pw) { res.writeHead(200, {'Content-Type':'text/html'}); res.end(sharePasswordFormHtml(shareId)); return; }
      if (!checkRateLimit(`share_pw:${ip}:${shareId}`, 10, 300000)) { res.writeHead(429, {'Content-Type':'text/html'}); res.end(sharePasswordFormHtml(shareId, 'Too many attempts. Try again in 5 minutes.')); return; }
      const hash = createHash('sha256').update(share.salt + pw + 'wc_share_2025').digest('hex');
      if (hash !== share.password_hash) { res.writeHead(200, {'Content-Type':'text/html'}); res.end(sharePasswordFormHtml(shareId, 'Wrong password, try again.')); return; }
    }
    const map = await loadRouteMapAsync(share.out_dir);
    if (!map) { res.writeHead(404); res.end('Clone no longer exists'); return; }
    const filename = map[share.route] || map['/'];
    if (!filename) { res.writeHead(404); res.end('Route not found'); return; }
    const data = await readCloneFile(share.out_dir, join('captured-pages', filename));
    if (!data) { res.writeHead(404); res.end('Page file missing'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(rewritePreviewAssetUrls(data.toString('utf8'), share.out_dir));
    return;
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  if (req.method === 'GET' && url.pathname === '/admin') return serveFile(res, join(__dirname, 'public', 'admin.html'), 'text/html');

  if (req.method === 'POST' && url.pathname === '/api/admin/auth') {
    if (!checkRateLimit(`admin_login:${ip}`, 5, 300000)) return json(res, { error: 'Too many attempts. Try again in 5 minutes.' }, 429);
    const { password } = await readJsonBody(req);
    if (!password || password !== ADMIN_PASSWORD) return json(res, { error: 'Wrong password' }, 401);
    const token = randomUUID();
    adminSessions.set(token, Date.now() + 8 * 3600 * 1000);
    return json(res, { token });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
    adminSessions.delete(req.headers['x-admin-token'] || '');
    return json(res, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/stats') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const users = await getAllUsers();
    const clones = await getAllClones();
    const payments = await getAllPayments();
    const errors = await getAllErrors();
    const activeNow = [...jobs.values()].filter(j => j.status === 'running').length;
    const confirmed = payments.filter(p => p.status === 'confirmed');
    const now2 = new Date();
    const ms = new Date(now2.getFullYear(), now2.getMonth(), 1);
    const monthRevenue = confirmed.filter(p => new Date(p.processed_at) >= ms).reduce((s, p) => s + (p.amount || 0), 0);
    const totalRevenue = confirmed.reduce((s, p) => s + (p.amount || 0), 0);
    // MRR = sum of monthly-equivalent active subscriptions
    const activePaidUsers = users.filter(u => u.plan !== 'free' && u.plan_renews_at && new Date(u.plan_renews_at) > now2);
    const mrr = activePaidUsers.reduce((s, u) => {
      const p = PLAN_PRICES[u.plan] || { monthly: 0, annual: 0 };
      return s + (u.billing_interval === 'annual' ? p.annual / 12 : p.monthly);
    }, 0);
    return json(res, {
      totalUsers: users.length,
      blockedUsers: users.filter(u => u.blocked).length,
      totalClones: clones.length,
      activeNow,
      totalRevenue,
      monthRevenue,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      pendingPayments: payments.filter(p => p.status === 'pending').length,
      proUsers: users.filter(u => ['growth', 'pro'].includes(u.plan)).length,
      starterUsers: users.filter(u => u.plan === 'starter').length,
      enterpriseUsers: users.filter(u => ['unlimited', 'enterprise'].includes(u.plan)).length,
      totalErrors: errors.length,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/users') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const users = await getAllUsers();
    const clones = await getAllClones();
    return json(res, users.map(u => {
      const uc = clones.filter(c => c.user_id === u.id);
      return {
        id: u.id, name: u.name, email: u.email,
        plan: u.plan || 'free', planRenewsAt: u.plan_renews_at || null,
        billingInterval: u.billing_interval || 'monthly',
        blocked: u.blocked === 1, createdAt: u.created_at,
        cloneCount: uc.length,
        lastCloneAt: uc.length > 0 ? uc[uc.length - 1].started_at : null,
      };
    }));
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/admin/users/')) {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const userId = url.pathname.slice('/api/admin/users/'.length);
    const body = await readJsonBody(req);
    const user = await getUserById(userId);
    if (!user) return json(res, { error: 'User not found' }, 404);
    const fields = {};
    if (body.plan !== undefined) fields.plan = body.plan;
    if (body.planRenewsAt !== undefined) fields.plan_renews_at = body.planRenewsAt;
    if (body.billingInterval !== undefined) fields.billing_interval = body.billingInterval;
    if (body.blocked !== undefined) fields.blocked = body.blocked ? 1 : 0;
    await updateUser(userId, fields);
    audit(null, 'admin', 'admin_update_user', `userId=${userId} ${JSON.stringify(fields)}`, ip);
    return json(res, { ok: true });
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/users/')) {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const userId = url.pathname.slice('/api/admin/users/'.length);
    const user = await getUserById(userId);
    if (!user) return json(res, { error: 'User not found' }, 404);
    await deleteUserSessions(userId);
    await deleteUserClones(userId);
    await deleteUser(userId);
    audit(null, 'admin', 'admin_delete_user', `userId=${userId} email=${user.email}`, ip);
    return json(res, { ok: true });
  }

  // POST /api/admin/impersonate/:userId — create an impersonation session
  if (req.method === 'POST' && url.pathname.startsWith('/api/admin/impersonate/')) {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const userId = url.pathname.slice('/api/admin/impersonate/'.length);
    const user = await getUserById(userId);
    if (!user) return json(res, { error: 'User not found' }, 404);
    const token = randomUUID();
    await insertSession({ token, userId: user.id, createdAt: new Date().toISOString(), expiresAt: Date.now() + 2*60*60*1000, impersonatedBy: 'admin' });
    audit(null, 'admin', 'impersonate', `userId=${userId} email=${user.email}`, ip);
    return json(res, { token, user: userPublic(user) });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/clones') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const users = await getAllUsers();
    const clones = await getAllClones();
    const userFilter = url.searchParams.get('userId') || '';
    const search = (url.searchParams.get('search') || '').toLowerCase();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = 50;
    const running = [...jobs.values()]
      .filter(j => j.status === 'running')
      .map(j => ({ id: j.id, user_id: j.userId, user_name: j.userName || 'Anonymous', url: j.url, status: j.status, pages: j.pages, assets: j.assets, started_at: j.startedAt, completed_at: null }));
    const all = [
      ...running,
      ...clones.map(c => ({ ...c, user_name: c.user_id ? (users.find(u => u.id === c.user_id)?.name || 'Deleted') : 'Anonymous' })),
    ]
      .filter(c => !userFilter || c.user_id === userFilter)
      .filter(c => !search || c.url.toLowerCase().includes(search) || (c.user_name || '').toLowerCase().includes(search));
    const total = all.length;
    const items = all.slice((page - 1) * pageSize, page * pageSize).map(c => ({
      id: c.id, userId: c.user_id, userName: c.user_name, url: c.url,
      status: c.status, pages: c.pages, assets: c.assets,
      startedAt: c.started_at, completedAt: c.completed_at,
    }));
    return json(res, { items, total, page, pageSize });
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/clones/')) {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const cloneId = url.pathname.slice('/api/admin/clones/'.length);
    await deleteCloneById(cloneId);
    return json(res, { ok: true });
  }

  // GET /api/admin/audit?page=&action=
  if (req.method === 'GET' && url.pathname === '/api/admin/audit') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = 100;
    const items = await getAuditLog(pageSize, (page - 1) * pageSize);
    const total = await getAuditCount().c;
    return json(res, { items, total, page, pageSize });
  }

  // POST /api/admin/announce — broadcast email to users
  if (req.method === 'POST' && url.pathname === '/api/admin/announce') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const { title, body: msgBody, sentTo } = await readJsonBody(req);
    if (!title || !msgBody) return json(res, { error: 'Title and body are required' }, 400);
    const validTargets = ['all', 'free', ...ALL_PAID_PLAN_KEYS, 'paid'];
    const target = validTargets.includes(sentTo) ? sentTo : 'all';
    const users = await getAllUsers();
    const targets = users.filter(u => {
      if (target === 'all') return true;
      if (target === 'paid') return u.plan !== 'free';
      return u.plan === target;
    });
    const id = randomUUID();
    await insertAnnouncement({ id, title, body: msgBody, sentTo: target, recipientCount: targets.length, createdAt: new Date().toISOString() });
    audit(null, 'admin', 'announce', `to=${target} recipients=${targets.length} title="${title}"`, ip);
    // Send emails (fire and forget)
    (async () => {
      for (const u of targets) {
        await sendEmail(u.email, title,
          renderEmail('announcement', { SUBJECT: title, NAME: u.name, TITLE: title, BODY: msgBody.replace(/\n/g, '<br>') })
        ).catch(() => {});
      }
    })();
    return json(res, { ok: true, recipientCount: targets.length });
  }

  // GET /api/admin/announcements
  if (req.method === 'GET' && url.pathname === '/api/admin/announcements') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    return json(res, await getAllAnnouncements());
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  if (req.method === 'GET' && url.pathname === '/api/payments/settings') {
    const s = getStripeSettings();
    const stripeReason = stripeUnavailableReason();
    return json(res, {
      btc: s.btc, eth: s.eth, usdt_trc20: s.usdt_trc20,
      paypal_email: s.paypal_email, paypal_me: s.paypal_me,
      stripe_enabled: !!s.stripe_secret_key,
      stripe_ready: !stripeReason,
      stripe_error: stripeReason,
      stripe_publishable_key: s.stripe_publishable_key || '',
      google_oauth_enabled: !!s.google_client_id,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/payments/plans') {
    return json(res, { plans: PLAN_PRICES });
  }

  if (req.method === 'POST' && url.pathname === '/api/payments/submit') {
    const user = await getSessionUser(req);
    if (!user) return json(res, { error: 'Sign in to submit a payment.' }, 401);
    if (!checkRateLimit(`pay_submit:${ip}`, 5, 3600000)) return json(res, { error: 'Too many requests.' }, 429);
    const { plan, method, txId, note, promoCode, interval } = await readJsonBody(req);
    if (!plan || !ALL_PAID_PLAN_KEYS.includes(plan)) return json(res, { error: 'Invalid plan.' }, 400);
    const billingInterval = interval === 'annual' ? 'annual' : 'monthly';
    const validMethods = ['paypal', 'crypto_btc', 'crypto_eth', 'crypto_usdt'];
    if (!method || !validMethods.includes(method)) return json(res, { error: 'Invalid payment method.' }, 400);
    if (!txId || String(txId).trim().length < 4) return json(res, { error: 'Transaction ID is required.' }, 400);
    if (await getPendingPaymentByUserPlan(user.id, plan, 'pending')) return json(res, { error: 'You already have a pending payment for this plan. Please wait for confirmation.' }, 409);
    let discountPercent = 0, appliedCode = null;
    if (promoCode) {
      const codeRow = await getPromoCode(String(promoCode).toUpperCase().trim());
      if (codeRow &&
          (!codeRow.valid_until || new Date(codeRow.valid_until) > new Date()) &&
          (!codeRow.max_uses || codeRow.used_count < codeRow.max_uses) &&
          (!codeRow.plans || codeRow.plans === '[]' || JSON.parse(codeRow.plans).includes(plan))) {
        discountPercent = codeRow.discount_percent || 0;
        appliedCode = codeRow.code;
        await incrementPromoUsed(codeRow.code);
      }
    }
    const prices = PLAN_PRICES[plan] || { monthly: 0, annual: 0 };
    const baseAmount = prices[billingInterval] || 0;
    const amount = Math.round(Math.max(0, baseAmount * (1 - discountPercent / 100)) * 100) / 100;
    const payment = {
      id: randomUUID(), userId: user.id, userName: user.name, userEmail: user.email,
      plan, amount, currency: 'USD', method, txId: String(txId).trim(),
      note: String(note || '').trim().slice(0, 500),
      promoCode: appliedCode, discountPercent, interval: billingInterval,
      status: 'pending', submittedAt: new Date().toISOString(),
    };
    await insertPayment(payment);
    audit(user.id, user.name, 'payment_submit', `plan=${plan} interval=${billingInterval} amount=${amount}`, ip);
    return json(res, { ok: true, id: payment.id });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/payments') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const statusF = url.searchParams.get('status') || '';
    const methodF = url.searchParams.get('method') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = 50;
    let payments = await getAllPayments();
    if (statusF) payments = payments.filter(p => p.status === statusF);
    if (methodF) payments = payments.filter(p => p.method === methodF);
    const total = payments.length;
    const items = payments.slice((page - 1) * pageSize, page * pageSize);
    return json(res, { items, total, page, pageSize });
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/admin/payments/')) {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const payId = url.pathname.slice('/api/admin/payments/'.length);
    const { status, reason } = await readJsonBody(req);
    if (!['confirmed', 'rejected'].includes(status)) return json(res, { error: 'Invalid status' }, 400);
    const payment = await getPaymentById(payId);
    if (!payment) return json(res, { error: 'Payment not found' }, 404);
    const processedAt = new Date().toISOString();
    await updatePayment({ id: payId, status, processedAt, reason: String(reason || '').trim().slice(0, 500) });
    if (status === 'confirmed' && payment.user_id) {
      const user = await getUserById(payment.user_id);
      if (user) {
        const interval = payment.interval || 'monthly';
        const renewDate = new Date();
        if (interval === 'annual') renewDate.setFullYear(renewDate.getFullYear() + 1);
        else renewDate.setMonth(renewDate.getMonth() + 1);
        await updateUser(payment.user_id, { plan: payment.plan, plan_renews_at: renewDate.toISOString(), billing_interval: interval, renewal_reminder_sent: 0, usage_alert_sent: 0 });
        const s = getCachedSettings();
        const appUrl = s.app_url || `http://localhost:${PORT}`;
        sendEmail(user.email, `Payment confirmed — ${payment.plan} plan activated`,
          renderEmail('payment-confirmed', { SUBJECT: `${payment.plan} plan activated`, NAME: user.name, PLAN: payment.plan, AMOUNT: String(payment.amount), INTERVAL: interval, RENEWS_AT: renewDate.toLocaleDateString() })
        ).catch(() => {});
        audit(null, 'admin', 'payment_confirmed', `userId=${user.id} plan=${payment.plan} amount=${payment.amount}`, ip);
      }
    }
    if (status === 'rejected' && payment.user_id) {
      const user = await getUserById(payment.user_id);
      if (user) {
        const reasonBlock = reason ? `<p style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;font-size:13px;color:#991b1b;margin:0 0 16px">Reason: ${htmlEsc(reason)}</p>` : '';
        sendEmail(user.email, 'Your payment could not be confirmed',
          renderEmail('payment-rejected', { SUBJECT: 'Payment not confirmed', NAME: user.name, PLAN: payment.plan, REASON_BLOCK: reasonBlock })
        ).catch(() => {});
      }
    }
    return json(res, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/revenue') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const payments = await getAllPayments();
    const confirmed = payments.filter(p => p.status === 'confirmed');
    const now3 = new Date();
    const monthStart = new Date(now3.getFullYear(), now3.getMonth(), 1);
    const last6 = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now3.getFullYear(), now3.getMonth() - i, 1);
      const end = new Date(now3.getFullYear(), now3.getMonth() - i + 1, 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const amount = confirmed.filter(p => { const pd = new Date(p.processed_at); return pd >= d && pd < end; }).reduce((s, p) => s + (p.amount || 0), 0);
      last6.push({ label, amount });
    }
    const byPlan = {}, byMethod = {}, byInterval = {};
    for (const p of confirmed) {
      byPlan[p.plan] = (byPlan[p.plan] || 0) + (p.amount || 0);
      byMethod[p.method] = (byMethod[p.method] || 0) + (p.amount || 0);
      byInterval[p.interval || 'monthly'] = (byInterval[p.interval || 'monthly'] || 0) + (p.amount || 0);
    }
    // MRR from active subscriptions
    const users = await getAllUsers();
    const activePaid = users.filter(u => u.plan !== 'free' && u.plan_renews_at && new Date(u.plan_renews_at) > now3);
    const mrr = activePaid.reduce((s, u) => {
      const p = PLAN_PRICES[u.plan] || { monthly: 0, annual: 0 };
      return s + (u.billing_interval === 'annual' ? p.annual / 12 : p.monthly);
    }, 0);
    // Churn: users who downgraded to free in the last 30 days (approximated by renewal_reminder_sent)
    return json(res, {
      totalRevenue: confirmed.reduce((s, p) => s + (p.amount || 0), 0),
      monthRevenue: confirmed.filter(p => new Date(p.processed_at) >= monthStart).reduce((s, p) => s + (p.amount || 0), 0),
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      activePaidUsers: activePaid.length,
      confirmedCount: confirmed.length,
      pendingCount: payments.filter(p => p.status === 'pending').length,
      rejectedCount: payments.filter(p => p.status === 'rejected').length,
      byPlan, byMethod, byInterval,
      last6months: last6,
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/settings') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const raw = getCachedSettings();
    const stripe = getStripeSettings(raw);
    const body = {
      ...raw,
      stripe_publishable_key: raw.stripe_publishable_key || stripe.stripe_publishable_key,
      stripe_secret_key_configured: !!stripe.stripe_secret_key,
      stripe_webhook_secret_configured: !!stripe.stripe_webhook_secret,
    };
    for (const plan of ALL_PAID_PLAN_KEYS) {
      for (const interval of ['monthly', 'annual']) {
        const key = STRIPE_PRICE_KEY(plan, interval);
        body[key] = raw[key] || stripe[key] || '';
      }
    }
    return json(res, body);
  }

  if (req.method === 'PUT' && url.pathname === '/api/admin/settings') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const body = await readJsonBody(req);
    const current = getCachedSettings();
    const plainKeys = [
      'btc', 'eth', 'usdt_trc20', 'paypal_email', 'paypal_me', 'app_note',
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'app_url',
      'support_email',
      'stripe_publishable_key',
      'stripe_price_starter_monthly', 'stripe_price_starter_annual',
      'stripe_price_popular_monthly', 'stripe_price_popular_annual',
      'stripe_price_growth_monthly', 'stripe_price_growth_annual',
      'stripe_price_unlimited_monthly', 'stripe_price_unlimited_annual',
      'stripe_price_pro_monthly', 'stripe_price_pro_annual',
      'stripe_price_enterprise_monthly', 'stripe_price_enterprise_annual',
      // secret fields — only overwrite when a real value is sent (not masked placeholder)
      'stripe_secret_key', 'stripe_webhook_secret',
      'google_client_id', 'google_client_secret',
    ];
    for (const k of plainKeys) {
      if (body[k] !== undefined && !isMaskedSecret(body[k])) current[k] = String(body[k] || '').trim();
    }
    if (body.smtp_secure !== undefined) current.smtp_secure = body.smtp_secure === true || body.smtp_secure === 'true';
    await saveSettings(current);
    await invalidateSettingsCache();
    _mailerTransport = null;
    _stripeInstance = null; // force rebuild with new keys
    return json(res, { ok: true });
  }

  // ── Static pages ───────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/admin/stripe/test') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const stripe = getStripe();
    const reason = stripeUnavailableReason();
    if (!stripe) return json(res, { ok: false, error: reason || 'Stripe is not configured.' }, 503);
    try {
      const account = await stripe.accounts.retrieve();
      return json(res, {
        ok: true,
        accountId: account.id,
        mode: _stripeKey.startsWith('sk_test_') ? 'test' : 'live',
        chargesEnabled: !!account.charges_enabled,
        payoutsEnabled: !!account.payouts_enabled,
      });
    } catch (err) {
      return json(res, { ok: false, error: err.message }, 502);
    }
  }

  if (req.method === 'GET' && url.pathname === '/dashboard') return serveFile(res, join(__dirname, 'public', 'dashboard.html'), 'text/html');
  if (req.method === 'GET' && url.pathname === '/reset-password') return serveFile(res, join(__dirname, 'public', 'reset-password.html'), 'text/html');
  if (req.method === 'GET' && url.pathname === '/tos') return serveFile(res, join(__dirname, 'public', 'tos.html'), 'text/html');
  if (req.method === 'GET' && url.pathname === '/privacy') return serveFile(res, join(__dirname, 'public', 'privacy.html'), 'text/html');

  // ── Password reset ─────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/auth/forgot-password') {
    if (!checkRateLimit(`forgot:${ip}`, 5, 3600000)) return json(res, { error: 'Too many requests' }, 429);
    const { email } = await readJsonBody(req);
    if (!email) return json(res, { ok: true });
    const user = await getUserByEmail(String(email).toLowerCase().trim());
    if (user) {
      const resetToken = randomUUID().replace(/-/g, '');
      await updateUser(user.id, { reset_token: resetToken, reset_expiry: Date.now() + 3600 * 1000 });
      const s = getCachedSettings();
      const appUrl = s.app_url || `http://localhost:${PORT}`;
      sendEmail(user.email, 'Reset your CLONYFY password',
        renderEmail('reset-password', { SUBJECT: 'Reset your password', NAME: user.name, LINK: `${appUrl}/reset-password?token=${resetToken}` })
      ).catch(() => {});
    }
    return json(res, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/reset-password') {
    const { token, password } = await readJsonBody(req);
    if (!token || !password || password.length < 8) return json(res, { error: 'Token and new password (min 8 chars) required' }, 400);
    const user = await getUserByResetToken(token, Date.now());
    if (!user) return json(res, { error: 'Reset link is invalid or expired' }, 400);
    const { hash: newHash, salt: newSalt } = await hashPw(password);
    await updateUser(user.id, { hash: newHash, salt: newSalt, reset_token: null, reset_expiry: null });
    audit(user.id, user.name, 'password_reset', null, ip);
    return json(res, { ok: true });
  }

  // ── User dashboard & billing ───────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/user/dashboard') {
    const user = await getSessionUser(req);
    if (!user) return json(res, { error: 'Not authenticated' }, 401);
    const userClones = await getClonesByUser(user.id);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const clonesThisMonth = userClones.filter(c => new Date(c.started_at) >= monthStart).length;
    const plan = user.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    const totalPages = userClones.reduce((s, c) => s + (c.pages || 0), 0);
    const totalAssets = userClones.reduce((s, c) => s + (c.assets || 0), 0);
    return json(res, {
      user: userPublic(user),
      impersonatedBy: user._impersonatedBy || null,
      usage: { clonesThisMonth, limitThisMonth: limits.clonesPerMonth === Infinity ? null : limits.clonesPerMonth, totalClones: userClones.length, totalPages, totalAssets },
      recentClones: userClones.slice(0, 10).map(c => ({ id: c.id, url: c.url, status: c.status, pages: c.pages, startedAt: c.started_at })),
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/user/billing') {
    const user = await getSessionUser(req);
    if (!user) return json(res, { error: 'Not authenticated' }, 401);
    return json(res, { payments: await getPaymentsByUser(user.id) });
  }

  if (req.method === 'PUT' && url.pathname === '/api/user/profile') {
    const user = await getSessionUser(req);
    if (!user) return json(res, { error: 'Not authenticated' }, 401);
    const { name, password } = await readJsonBody(req);
    const fields = {};
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return json(res, { error: 'Name is required' }, 400);
      fields.name = trimmed;
    }
    if (password) {
      if (password.length < 8) return json(res, { error: 'Password must be at least 8 characters' }, 400);
      const { hash: pwHash, salt: pwSalt } = await hashPw(password);
      fields.hash = pwHash;
      fields.salt = pwSalt;
    }
    await updateUser(user.id, fields);
    return json(res, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/user/cancel-subscription') {
    const user = await getSessionUser(req);
    if (!user) return json(res, { error: 'Not authenticated' }, 401);
    if (user.plan === 'free') return json(res, { error: 'No active subscription to cancel' }, 400);
    if (user.stripe_subscription_id) {
      const stripe = getStripe();
      if (!stripe) return json(res, { error: stripeUnavailableReason() || 'Stripe is not configured. Contact support.' }, 503);
      try {
        await stripe.subscriptions.update(user.stripe_subscription_id, { cancel_at_period_end: true });
      } catch (err) {
        return json(res, { error: `Stripe cancellation failed: ${err.message}` }, 502);
      }
    }
    await updateUser(user.id, { cancel_at_period_end: 1 });
    audit(user.id, user.name, 'cancel_subscription', user.plan, ip);
    return json(res, { ok: true });
  }

  // DELETE /api/user/account — GDPR account deletion
  if (req.method === 'DELETE' && url.pathname === '/api/user/account') {
    const user = await getSessionUser(req);
    if (!user) return json(res, { error: 'Not authenticated' }, 401);
    const { password } = await readJsonBody(req);
    if (!password) return json(res, { error: 'Password confirmation required' }, 400);
    const ok = await verifyPw(password, user);
    if (!ok) return json(res, { error: 'Wrong password' }, 401);
    const token = user._sessionToken;
    audit(user.id, user.name, 'account_deleted', `email=${user.email}`, ip);
    await deleteUserSessions(user.id);
    await deleteUserClones(user.id);
    await deleteUser(user.id);
    return json(res, { ok: true });
  }

  // GET /api/user/export — GDPR data export
  if (req.method === 'GET' && url.pathname === '/api/user/export') {
    const user = await getSessionUser(req);
    if (!user) return json(res, { error: 'Not authenticated' }, 401);
    const clones = await getClonesByUser(user.id);
    const payments = await getPaymentsByUser(user.id);
    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id, name: user.name, email: user.email,
        plan: user.plan, createdAt: user.created_at,
        emailVerified: user.email_verified === 1,
      },
      clones: clones.map(c => ({ id: c.id, url: c.url, status: c.status, pages: c.pages, startedAt: c.started_at, completedAt: c.completed_at })),
      payments: payments.map(p => ({ id: p.id, plan: p.plan, amount: p.amount, method: p.method, status: p.status, submittedAt: p.submitted_at })),
    };
    audit(user.id, user.name, 'data_export', null, ip);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="clonyfy-data-${user.id}.json"`,
    });
    res.end(JSON.stringify(exportData, null, 2));
    return;
  }

  // ── Promo codes ────────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/payments/validate-promo') {
    const { code, plan } = await readJsonBody(req);
    if (!code) return json(res, { error: 'Code required' }, 400);
    const found = await getPromoCode(String(code).toUpperCase().trim());
    if (!found ||
        (found.valid_until && new Date(found.valid_until) <= new Date()) ||
        (found.max_uses && found.used_count >= found.max_uses) ||
        (found.plans && found.plans !== '[]' && plan && !JSON.parse(found.plans).includes(plan))) {
      return json(res, { error: 'Invalid or expired promo code' }, 404);
    }
    return json(res, { valid: true, code: found.code, discountPercent: found.discount_percent || 0, description: found.description || '' });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/promo-codes') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    return json(res, await getAllPromoCodes().map(c => ({ ...c, plans: JSON.parse(c.plans || '[]') })));
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/promo-codes') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const body = await readJsonBody(req);
    const code = String(body.code || '').toUpperCase().trim().replace(/[^A-Z0-9_-]/g, '');
    if (!code || code.length < 3) return json(res, { error: 'Code must be at least 3 characters' }, 400);
    const discountPercent = Math.min(100, Math.max(0, parseInt(body.discountPercent, 10) || 0));
    if (await getPromoCode(code)) return json(res, { error: 'Code already exists' }, 409);
    await insertPromoCode({
      code, discountPercent,
      description: String(body.description || '').trim().slice(0, 200),
      maxUses: body.maxUses ? parseInt(body.maxUses, 10) : null,
      plans: JSON.stringify(Array.isArray(body.plans) ? body.plans : []),
      validUntil: body.validUntil || null,
      createdAt: new Date().toISOString(),
    });
    return json(res, { ok: true, code });
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/promo-codes/')) {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    await deletePromoCode(decodeURIComponent(url.pathname.slice('/api/admin/promo-codes/'.length)));
    return json(res, { ok: true });
  }

  // ── Error log ──────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/admin/errors') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    const search = (url.searchParams.get('search') || '').toLowerCase();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = 50;
    let errors = await getAllErrors();
    if (search) errors = errors.filter(e => e.url.toLowerCase().includes(search) || (e.user_name || '').toLowerCase().includes(search) || (e.error_summary || '').toLowerCase().includes(search));
    const total = errors.length;
    const items = errors.slice((page - 1) * pageSize, page * pageSize).map(e => ({
      id: e.id, userId: e.user_id, userName: e.user_name, url: e.url,
      errorSummary: e.error_summary, logs: JSON.parse(e.logs || '[]'),
      startedAt: e.started_at, failedAt: e.failed_at,
    }));
    return json(res, { items, total, page, pageSize });
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/errors/') && url.pathname !== '/api/admin/errors/') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    await deleteError(url.pathname.slice('/api/admin/errors/'.length));
    return json(res, { ok: true });
  }

  if (req.method === 'DELETE' && url.pathname === '/api/admin/errors') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    await clearErrors();
    return json(res, { ok: true });
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────────

  if (req.method === 'GET' && url.pathname === '/api/auth/google') {
    const s = getCachedSettings();
    if (!s.google_client_id) return json(res, { error: 'Google OAuth not configured' }, 503);
    const state = randomUUID().replace(/-/g, '');
    _oauthStates.set(state, Date.now() + 10 * 60 * 1000); // 10 min
    const appUrl = s.app_url || `http://localhost:${PORT}`;
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: s.google_client_id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/google/callback') {
    const s = getCachedSettings();
    const appUrl = s.app_url || `http://localhost:${PORT}`;
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const errParam = url.searchParams.get('error');
    if (errParam || !code || !state) { res.writeHead(302, { Location: `${appUrl}/app?oauth_error=cancelled` }); res.end(); return; }
    if (!_oauthStates.has(state)) { res.writeHead(302, { Location: `${appUrl}/app?oauth_error=invalid_state` }); res.end(); return; }
    _oauthStates.delete(state);
    try {
      const redirectUri = `${appUrl}/api/auth/google/callback`;
      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: s.google_client_id, client_secret: s.google_client_secret || '', redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      });
      if (!tokenRes.ok) throw new Error('token exchange failed');
      const { access_token } = await tokenRes.json();

      // Get user info
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!userInfoRes.ok) throw new Error('userinfo failed');
      const gUser = await userInfoRes.json();
      const googleId = gUser.sub;
      const googleEmail = (gUser.email || '').toLowerCase().trim();
      const googleName = gUser.name || googleEmail.split('@')[0];

      // Find or create user
      let dbUser = await getUserByGoogleId(googleId);
      if (!dbUser && googleEmail) dbUser = await getUserByEmail(googleEmail);
      if (dbUser) {
        // Link google_id if not already linked
        if (!dbUser.google_id) await updateUser(dbUser.id, { google_id: googleId, email_verified: 1 });
      } else {
        // New user via Google
        const newId = randomUUID();
        await insertOAuthUser({ id: newId, name: googleName, email: googleEmail, googleId, createdAt: new Date().toISOString() });
        dbUser = await getUserById(newId);
        audit(newId, googleName, 'register_google', null, ip);
      }

      if (dbUser.blocked) { res.writeHead(302, { Location: `${appUrl}/app?oauth_error=blocked` }); res.end(); return; }

      const sessionToken = randomUUID();
      await insertSession({ token: sessionToken, userId: dbUser.id, createdAt: new Date().toISOString(), expiresAt: Date.now() + 30*24*60*60*1000, impersonatedBy: null });
      audit(dbUser.id, dbUser.name, 'login_google', null, ip);

      res.writeHead(302, { Location: `${appUrl}/app?oauth_token=${sessionToken}` });
      res.end();
    } catch (err) {
      console.error('[Google OAuth]', err.message);
      res.writeHead(302, { Location: `${appUrl}/app?oauth_error=server_error` });
      res.end();
    }
    return;
  }

  // ── Stripe ────────────────────────────────────────────────────────────────────

  // POST /api/payments/stripe/checkout — create a Stripe Checkout session
  if (req.method === 'POST' && url.pathname === '/api/payments/stripe/checkout') {
    const user = await getSessionUser(req);
    if (!user) return json(res, { error: 'Sign in first.' }, 401);
    const stripe = getStripe();
    if (!stripe) return json(res, { error: stripeUnavailableReason() || 'Stripe is not configured. Contact support.' }, 503);
    const { plan, interval, promoCode } = await readJsonBody(req);
    if (!plan || !ALL_PAID_PLAN_KEYS.includes(plan)) return json(res, { error: 'Invalid plan.' }, 400);
    const bi = interval === 'annual' ? 'annual' : 'monthly';
    let priceId = '';
    try {
      priceId = await ensureStripePrice(stripe, plan, bi);
    } catch (err) {
      return json(res, { error: `Stripe price setup failed: ${err.message}` }, 502);
    }
    const appUrl = publicAppUrl(req);

    // Ensure Stripe customer exists
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
      customerId = customer.id;
      await updateUser(user.id, { stripe_customer_id: customerId });
    }

    // Validate promo code via Stripe if provided
    let discounts = undefined;
    if (promoCode) {
      try {
        const codes = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1 });
        if (codes.data.length > 0) discounts = [{ promotion_code: codes.data[0].id }];
      } catch {}
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: !discounts,
      ...(discounts ? { discounts } : {}),
      metadata: { userId: user.id, plan, interval: bi },
      subscription_data: { metadata: { userId: user.id, plan, interval: bi } },
      success_url: `${appUrl}/dashboard?stripe=success`,
      cancel_url: `${appUrl}/dashboard?stripe=cancelled`,
    });
    audit(user.id, user.name, 'stripe_checkout_created', `plan=${plan} interval=${bi}`, ip);
    return json(res, { url: session.url });
  }

  // POST /api/payments/stripe/portal — billing portal for self-service
  if (req.method === 'POST' && url.pathname === '/api/payments/stripe/portal') {
    const user = await getSessionUser(req);
    if (!user) return json(res, { error: 'Not authenticated' }, 401);
    const stripe = getStripe();
    if (!stripe) return json(res, { error: stripeUnavailableReason() || 'Stripe not configured' }, 503);
    if (!user.stripe_customer_id) return json(res, { error: 'No Stripe subscription found' }, 400);
    const appUrl = publicAppUrl(req);
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${appUrl}/dashboard`,
    });
    return json(res, { url: portal.url });
  }

  // POST /api/stripe/webhook — Stripe event handler (requires raw body)
  if (req.method === 'POST' && url.pathname === '/api/stripe/webhook') {
    const stripe = getStripe();
    if (!stripe) { res.writeHead(503); res.end(stripeUnavailableReason() || 'Stripe not configured'); return; }
    const rawBody = await readRawBody(req);
    const sig = req.headers['stripe-signature'] || '';
    const s = getStripeSettings();
    if (!s.stripe_webhook_secret) { res.writeHead(503); res.end('Stripe webhook secret not configured'); return; }
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, s.stripe_webhook_secret || '');
    } catch (err) {
      console.error('[Stripe webhook] signature verification failed:', err.message);
      try { await insertError({ id: randomUUID(), userId: null, userName: 'stripe-webhook', url: '/api/stripe/webhook', errorSummary: 'Signature verification failed: ' + err.message, logs: '[]', startedAt: new Date().toISOString(), failedAt: new Date().toISOString() }); await pruneErrors(); } catch {}
      res.writeHead(400); res.end('Invalid signature');
      return;
    }

    const appUrl = publicAppUrl(req);

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        if (session.payment_status === 'paid' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          const userId = sub.metadata?.userId || session.metadata?.userId;
          const plan = sub.metadata?.plan || session.metadata?.plan;
          const bi = sub.metadata?.interval || session.metadata?.interval || 'monthly';
          if (userId && plan) {
            const periodEnd = stripePeriodEnd(sub);
            const renewsAt = periodEnd ? new Date(periodEnd * 1000) : new Date(Date.now() + (bi === 'annual' ? 365 : 31) * 24 * 60 * 60 * 1000);
            await updateUser(userId, { plan, billing_interval: bi, plan_renews_at: renewsAt.toISOString(), stripe_subscription_id: sub.id, renewal_reminder_sent: 0, usage_alert_sent: 0 });
            const u = await getUserById(userId);
            if (u) {
              await insertPayment({ id: randomUUID(), userId, userName: u.name, userEmail: u.email, plan, amount: (session.amount_total || 0) / 100, currency: (session.currency || 'usd').toUpperCase(), method: 'stripe', txId: session.payment_intent || session.id, note: '', promoCode: null, discountPercent: 0, interval: bi, status: 'confirmed', submittedAt: new Date().toISOString() });
              sendEmail(u.email, `Payment confirmed — ${plan} plan activated`,
                renderEmail('payment-confirmed', { SUBJECT: `${plan} plan activated`, NAME: u.name, PLAN: plan, AMOUNT: String((session.amount_total || 0) / 100), INTERVAL: bi, RENEWS_AT: renewsAt.toLocaleDateString() })
              ).catch(() => {});
              audit(userId, u.name, 'stripe_payment_confirmed', `plan=${plan} amount=${(session.amount_total||0)/100}`, null);
            }
          }
        }
      }

      if (event.type === 'customer.subscription.updated') {
        const sub = event.data.object;
        const customerUser = sub.customer ? await getUserByStripeCustomerId(sub.customer) : null;
        const userId = sub.metadata?.userId || customerUser?.id;
        if (userId && sub.status === 'active') {
          const plan = sub.metadata?.plan || customerUser?.plan;
          const bi = sub.metadata?.interval || customerUser?.billing_interval || 'monthly';
          const periodEnd = stripePeriodEnd(sub);
          const renewsAt = periodEnd ? new Date(periodEnd * 1000) : null;
          if (plan) await updateUser(userId, { plan, billing_interval: bi, ...(renewsAt ? { plan_renews_at: renewsAt.toISOString() } : {}), stripe_subscription_id: sub.id, renewal_reminder_sent: 0, cancel_at_period_end: sub.cancel_at_period_end ? 1 : 0 });
        }
      }

      if (event.type === 'invoice.payment_succeeded') {
        const inv = event.data.object;
        const customerId = inv.customer;
        const u = customerId ? await getUserByStripeCustomerId(customerId) : null;
        const subscriptionId = inv.subscription || inv.parent?.subscription_details?.subscription || null;
        if (u && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const plan = sub.metadata?.plan || u.plan;
          const bi = sub.metadata?.interval || u.billing_interval || 'monthly';
          const periodEnd = stripePeriodEnd(sub);
          const renewsAt = periodEnd ? new Date(periodEnd * 1000) : null;
          await updateUser(u.id, { plan, billing_interval: bi, ...(renewsAt ? { plan_renews_at: renewsAt.toISOString() } : {}), stripe_subscription_id: sub.id, renewal_reminder_sent: 0, usage_alert_sent: 0, cancel_at_period_end: sub.cancel_at_period_end ? 1 : 0 });
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object;
        const customerUser = sub.customer ? await getUserByStripeCustomerId(sub.customer) : null;
        const userId = sub.metadata?.userId || customerUser?.id;
        if (userId) {
          await updateUser(userId, { plan: 'free', plan_renews_at: null, stripe_subscription_id: null, cancel_at_period_end: 0, renewal_reminder_sent: 0, usage_alert_sent: 0 });
          const u = await getUserById(userId);
          if (u) {
            sendEmail(u.email, 'Your account has been downgraded to Free',
              renderEmail('downgraded', { SUBJECT: 'Account downgraded to Free', NAME: u.name })
            ).catch(() => {});
            audit(userId, u.name, 'stripe_subscription_deleted', null, null);
          }
        }
      }

      if (event.type === 'invoice.payment_failed') {
        const inv = event.data.object;
        const customerId = inv.customer;
        const u = customerId ? await getUserByStripeCustomerId(customerId) : null;
        if (u) {
          let portalUrl = appUrl + '/dashboard';
          try {
            const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: appUrl + '/dashboard' });
            portalUrl = portal.url;
          } catch {}
          sendEmail(u.email, 'Payment failed — action required',
            renderEmail('payment-failed', { SUBJECT: 'Payment failed', NAME: u.name, PLAN: u.plan, PORTAL_URL: portalUrl })
          ).catch(() => {});
          audit(u.id, u.name, 'stripe_payment_failed', `invoice=${inv.id}`, null);
        }
      }
    } catch (err) {
      console.error('[Stripe webhook handler]', err.message);
      try { await insertError({ id: randomUUID(), userId: null, userName: 'stripe-webhook', url: '/api/stripe/webhook', errorSummary: 'Webhook handler error: ' + err.message, logs: '[]', startedAt: new Date().toISOString(), failedAt: new Date().toISOString() }); await pruneErrors(); } catch {}
    }

    res.writeHead(200); res.end('ok');
    return;
  }

  // robots.txt
  if (req.method === 'GET' && url.pathname === '/robots.txt') {
    const host = publicAppUrl(req);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`User-agent: *\nDisallow: /api/\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /share/\nSitemap: ${host}/sitemap.xml\n`);
    return;
  }

  // sitemap.xml
  if (req.method === 'GET' && url.pathname === '/sitemap.xml') {
    const host = publicAppUrl(req);
    const now = new Date().toISOString().split('T')[0];
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    const urls = [
      { loc: `${host}/`,           changefreq: 'weekly',  priority: '1.0' },
      { loc: `${host}/app`,        changefreq: 'monthly', priority: '0.8' },
      { loc: `${host}/privacy`,    changefreq: 'monthly', priority: '0.3' },
      { loc: `${host}/tos`,        changefreq: 'monthly', priority: '0.3' },
    ];
    const urlset = urls.map(u => `<url><loc>${u.loc}</loc><lastmod>${now}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('');
    res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlset}</urlset>`);
    return;
  }

  // ── Deploy to Netlify ────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/deploy/netlify') {
    const deployUser = await getSessionUser(req);
    if (!deployUser) return json(res, { error: 'Not authenticated' }, 401);
    if ((deployUser.plan || 'free') === 'free') return json(res, { error: 'Deploy requires a paid plan. Upgrade to deploy your clones.' }, 403);
    let body; try { body = await readJsonBody(req); } catch { return json(res, { error: 'Bad request' }, 400); }
    const { outDir, netlifyToken } = body;
    if (!netlifyToken) return json(res, { error: 'Netlify personal access token is required' }, 400);
    if (!isInsideOutputDir(outDir)) return json(res, { error: 'Invalid output folder' }, 400);
    if (!await canUseCloneOutput(deployUser, outDir)) return json(res, { error: 'Not found' }, 404);

    const deployTmp = join(OUTPUT_DIR, `__deploy_${randomUUID().slice(0,8)}`);
    const zipPath = deployTmp + '.zip';
    let materialized = null;
    try {
      materialized = await materializeCloneOutput(outDir);
      mkdirSync(deployTmp, { recursive: true });
      const routeMapPath = join(materialized.dir, 'route-map.json');
      const capturedPagesDir = join(materialized.dir, 'captured-pages');
      const assetsDir = join(materialized.dir, 'public', '_assets');

      if (existsSync(routeMapPath) && existsSync(capturedPagesDir)) {
        const routeMap = JSON.parse(readFileSync(routeMapPath, 'utf8'));
        for (const [route, filename] of Object.entries(routeMap)) {
          const srcPath = join(capturedPagesDir, filename);
          if (!existsSync(srcPath)) continue;
          let destPath;
          if (route === '/') { destPath = join(deployTmp, 'index.html'); }
          else {
            const seg = route.replace(/^\//, '').replace(/\/+$/, '');
            destPath = join(deployTmp, seg, 'index.html');
          }
          mkdirSync(dirname(destPath), { recursive: true });
          copyFileSync(srcPath, destPath);
        }
      } else if (existsSync(capturedPagesDir)) {
        for (const f of readdirSync(capturedPagesDir)) {
          if (f.endsWith('.html')) copyFileSync(join(capturedPagesDir, f), join(deployTmp, f));
        }
      }

      if (existsSync(assetsDir)) {
        const destAssets = join(deployTmp, '_assets');
        mkdirSync(destAssets, { recursive: true });
        for (const f of readdirSync(assetsDir)) copyFileSync(join(assetsDir, f), join(destAssets, f));
      }

      const isWin = process.platform === 'win32';
      const zipCmd = isWin
        ? `powershell -NoProfile -Command "Compress-Archive -Path '${deployTmp}\\*' -DestinationPath '${zipPath}' -Force"`
        : `cd '${deployTmp}' && zip -r '${zipPath}' .`;
      await new Promise((res2, rej) => {
        const p = spawn(zipCmd, [], { shell: true, stdio: 'ignore' });
        p.on('close', code => code === 0 ? res2() : rej(new Error(`zip exited ${code}`)));
      });

      const zipData = readFileSync(zipPath);

      const siteResp = await netlifyAPIRequest('POST', '/api/v1/sites', netlifyToken, JSON.stringify({}), 'application/json');
      if (siteResp.status >= 400) return json(res, { error: siteResp.body.message || `Netlify: ${siteResp.status}` }, 502);
      const siteId = siteResp.body.id;
      const subdomain = siteResp.body.subdomain;

      const deployResp = await netlifyAPIRequest('POST', `/api/v1/sites/${siteId}/deploys`, netlifyToken, zipData, 'application/zip');
      if (deployResp.status >= 400) return json(res, { error: deployResp.body.message || `Deploy failed: ${deployResp.status}` }, 502);

      const siteUrl = deployResp.body.deploy_ssl_url || deployResp.body.url || `https://${subdomain}.netlify.app`;
      return json(res, { ok: true, url: siteUrl, siteId });
    } catch(err) {
      return json(res, { error: err.message }, 500);
    } finally {
      if (materialized) materialized.cleanup();
      try { rmSync(deployTmp, { recursive: true, force: true }); } catch {}
      try { rmSync(zipPath); } catch {}
    }
  }

  // ── Support contact ────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/support/contact') {
    if (!checkRateLimit(`support:${ip}`, 3, 3600000)) return json(res, { error: 'Too many requests. Try again later.' }, 429);
    const { name, email, message } = await readJsonBody(req);
    if (!name || !email || !message) return json(res, { error: 'All fields are required.' }, 400);
    if (!email.includes('@')) return json(res, { error: 'Invalid email.' }, 400);
    const s = getCachedSettings();
    const supportEmail = s.support_email || s.smtp_from || '';
    if (supportEmail) {
      const subject = `Support request from ${name}`;
      const body = renderEmail('support-contact', {
        SUBJECT: subject,
        FROM_NAME: String(name).slice(0, 80),
        FROM_EMAIL: String(email).slice(0, 120),
        MESSAGE: String(message).slice(0, 2000).replace(/\n/g, '<br>'),
      });
      sendEmail(supportEmail, subject, body).catch(() => {});
    }
    audit(null, String(name).slice(0,80), 'support_contact', `email=${email}`, ip);
    return json(res, { ok: true });
  }

  // admin security check
  if (req.method === 'GET' && url.pathname === '/api/admin/security') {
    if (!isAdmin(req)) return json(res, { error: 'Unauthorized' }, 401);
    return json(res, {
      defaultAdminPassword: ADMIN_PASSWORD === 'admin123',
      smtpConfigured: !!(getCachedSettings().smtp_host),
      stripeConfigured: !!(getStripeSettings().stripe_secret_key),
      stripeError: stripeUnavailableReason(),
      appUrlConfigured: !!(getCachedSettings().app_url),
    });
  }

  const p404 = join(__dirname, 'public', '404.html');
  if (existsSync(p404)) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(readFileSync(p404));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

let _initialized = false;
async function ensureInit() {
  if (_initialized) return;
  _initialized = true;
  await initSettings();
  runDunning().catch(() => {});
  setInterval(runDunning, 3600000);
}

if (!process.env.VERCEL) {
  ensureInit().then(() => {
    createServer(handleRequest).listen(PORT, () => {
      console.log(`\n🌐 CLONYFY running at: http://localhost:${PORT}\n`);
    });
  });
}

export default async function handler(req, res) {
  await ensureInit();
  return handleRequest(req, res);
}
