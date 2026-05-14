import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  }
  _supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );
  return _supabase;
}

const supabase = new Proxy({}, {
  get(_target, prop) {
    return getSupabase()[prop];
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function one(query) {
  const { data, error } = await query.maybeSingle();
  if (error && error.code !== 'PGRST116') console.error('[DB one]', error.message);
  return data || null;
}

async function all(query) {
  const { data, error } = await query;
  if (error) console.error('[DB all]', error.message);
  return data || [];
}

// ── Users ─────────────────────────────────────────────────────────────────────

export const getUserById = (id) =>
  one(supabase.from('users').select('*').eq('id', id));

export const getUserByEmail = (email) =>
  one(supabase.from('users').select('*').eq('email', email));

export const getAllUsers = () =>
  all(supabase.from('users').select('*').order('created_at', { ascending: false }));

export const insertUser = async (u) => {
  const { error } = await supabase.from('users').insert({
    id: u.id, name: u.name, email: u.email, hash: u.hash || '',
    salt: u.salt || null, plan: 'free', email_verified: 0,
    verify_token: u.verifyToken || null, verify_expiry: u.verifyExpiry || null,
    created_at: u.createdAt,
  });
  if (error) throw new Error(error.message);
};

export const updateUser = async (id, fields) => {
  const allowed = [
    'name','email','hash','salt','plan','plan_renews_at','billing_interval',
    'email_verified','verify_token','verify_expiry','reset_token','reset_expiry',
    'blocked','cancel_at_period_end','renewal_reminder_sent','usage_alert_sent',
    'google_id','stripe_customer_id','stripe_subscription_id',
  ];
  const update = {};
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) update[k] = v;
  }
  if (!Object.keys(update).length) return;
  const { error } = await supabase.from('users').update(update).eq('id', id);
  if (error) throw new Error(error.message);
};

export const deleteUser = async (id) => {
  await supabase.from('users').delete().eq('id', id);
};

export const getUserByVerifyToken = (token, now) =>
  one(supabase.from('users').select('*').eq('verify_token', token).gt('verify_expiry', now));

export const getUserByResetToken = (token, now) =>
  one(supabase.from('users').select('*').eq('reset_token', token).gt('reset_expiry', now));

export const getUserByGoogleId = (googleId) =>
  one(supabase.from('users').select('*').eq('google_id', googleId));

export const getUserByStripeCustomerId = (customerId) =>
  one(supabase.from('users').select('*').eq('stripe_customer_id', customerId));

export const insertOAuthUser = async (u) => {
  const { error } = await supabase.from('users').insert({
    id: u.id, name: u.name, email: u.email, hash: '', salt: null,
    plan: 'free', email_verified: 1, google_id: u.googleId,
    verify_token: null, verify_expiry: null, created_at: u.createdAt,
  });
  if (error) throw new Error(error.message);
};

// ── Sessions ──────────────────────────────────────────────────────────────────

export const getSession = (token) =>
  one(supabase.from('sessions').select('*').eq('token', token));

export const insertSession = async (s) => {
  const { error } = await supabase.from('sessions').insert({
    token: s.token, user_id: s.userId, created_at: s.createdAt,
    expires_at: s.expiresAt, impersonated_by: s.impersonatedBy || null,
  });
  if (error) throw new Error(error.message);
};

export const deleteSession = async (token) => {
  await supabase.from('sessions').delete().eq('token', token);
};

export const deleteUserSessions = async (userId) => {
  await supabase.from('sessions').delete().eq('user_id', userId);
};

export const cleanExpiredSessions = async (now) => {
  await supabase.from('sessions').delete().lt('expires_at', now);
};

// ── Clones ────────────────────────────────────────────────────────────────────

export const insertClone = async (c) => {
  const { error } = await supabase.from('clones').upsert({
    id: c.id, user_id: c.userId, user_name: c.userName, url: c.url,
    out_dir: c.outDir, status: c.status, pages: c.pages ?? null,
    assets: c.assets ?? null, api_routes: c.apiRoutes ?? null,
    started_at: c.startedAt, completed_at: c.completedAt ?? null,
  });
  if (error) throw new Error(error.message);
};

export const updateCloneLabel = async ({ id, label }) => {
  await supabase.from('clones').update({ label: label ?? null }).eq('id', id);
};

export const getClonesByUser = (userId) =>
  all(supabase.from('clones').select('*').eq('user_id', userId).order('started_at', { ascending: false }));

export const getAllClones = () =>
  all(supabase.from('clones').select('*').order('started_at', { ascending: false }));

export const deleteCloneById = async (id) => {
  await supabase.from('clones').delete().eq('id', id);
};

export const deleteUserClones = async (userId) => {
  await supabase.from('clones').delete().eq('user_id', userId);
};

export const getCloneCountThisMonth = async (userId, monthStart) => {
  const { count } = await supabase.from('clones')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('started_at', monthStart);
  return count || 0;
};

// ── Payments ──────────────────────────────────────────────────────────────────

export const getAllPayments = () =>
  all(supabase.from('payments').select('*').order('submitted_at', { ascending: false }));

export const getPaymentsByUser = (userId) =>
  all(supabase.from('payments').select('*').eq('user_id', userId).order('submitted_at', { ascending: false }));

export const getPaymentById = (id) =>
  one(supabase.from('payments').select('*').eq('id', id));

export const insertPayment = async (p) => {
  const { error } = await supabase.from('payments').insert({
    id: p.id, user_id: p.userId, user_name: p.userName, user_email: p.userEmail,
    plan: p.plan, amount: p.amount, currency: p.currency, method: p.method,
    tx_id: p.txId, note: p.note, promo_code: p.promoCode,
    discount_percent: p.discountPercent, interval: p.interval,
    status: p.status, submitted_at: p.submittedAt,
  });
  if (error) throw new Error(error.message);
};

export const updatePayment = async ({ id, status, processedAt, reason }) => {
  await supabase.from('payments').update({ status, processed_at: processedAt, reason }).eq('id', id);
};

export const getPendingPaymentByUserPlan = (userId, plan, status) =>
  one(supabase.from('payments').select('*').eq('user_id', userId).eq('plan', plan).eq('status', status));

// ── Settings ──────────────────────────────────────────────────────────────────

export const getSetting = async (key) => {
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  return data;
};

export const setSetting = async (key, value) => {
  await supabase.from('settings').upsert({ key, value });
};

const SETTINGS_DEFAULTS = {
  btc:'', eth:'', usdt_trc20:'', paypal_email:'', paypal_me:'', app_note:'',
  smtp_host:'', smtp_port:'587', smtp_user:'', smtp_pass:'', smtp_from:'',
  smtp_secure:'false', app_url:'http://localhost:5000',
};

export async function getSettings() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return { ...SETTINGS_DEFAULTS, smtp_secure: false };
  }
  const { data } = await supabase.from('settings').select('key,value');
  const result = { ...SETTINGS_DEFAULTS };
  for (const { key, value } of (data || [])) result[key] = value;
  result.smtp_secure = result.smtp_secure === 'true';
  return result;
}

export async function saveSettings(obj) {
  const rows = Object.entries(obj).map(([key, value]) => ({ key, value: String(value ?? '') }));
  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

// ── Shares ────────────────────────────────────────────────────────────────────

export const getShare = (id) =>
  one(supabase.from('shares').select('*').eq('id', id));

export const insertShare = async (s) => {
  await supabase.from('shares').insert({
    id: s.id, out_dir: s.outDir, route: s.route,
    created_at: s.createdAt, password_hash: s.passwordHash,
    salt: s.salt, expires_at: s.expiresAt ?? null,
  });
};

export const deleteShare = async (id) => {
  await supabase.from('shares').delete().eq('id', id);
};

// ── Promo codes ───────────────────────────────────────────────────────────────

export const getAllPromoCodes = () =>
  all(supabase.from('promo_codes').select('*').order('created_at', { ascending: false }));

export const getPromoCode = (code) =>
  one(supabase.from('promo_codes').select('*').eq('code', code));

export const insertPromoCode = async (c) => {
  await supabase.from('promo_codes').insert({
    code: c.code, discount_percent: c.discountPercent, description: c.description,
    max_uses: c.maxUses, used_count: 0, plans: c.plans,
    valid_until: c.validUntil, created_at: c.createdAt,
  });
};

export const incrementPromoUsed = async (code) => {
  const { data } = await supabase.from('promo_codes').select('used_count').eq('code', code).maybeSingle();
  if (data) await supabase.from('promo_codes').update({ used_count: (data.used_count || 0) + 1 }).eq('code', code);
};

export const deletePromoCode = async (code) => {
  await supabase.from('promo_codes').delete().eq('code', code);
};

// ── Errors ────────────────────────────────────────────────────────────────────

export const getAllErrors = () =>
  all(supabase.from('errors').select('*').order('failed_at', { ascending: false }));

export const insertError = async (e) => {
  await supabase.from('errors').upsert({
    id: e.id, user_id: e.userId, user_name: e.userName, url: e.url,
    error_summary: e.errorSummary, logs: e.logs,
    started_at: e.startedAt, failed_at: e.failedAt,
  });
};

export const deleteError = async (id) => {
  await supabase.from('errors').delete().eq('id', id);
};

export const clearErrors = async () => {
  await supabase.from('errors').delete().neq('id', '');
};

export const pruneErrors = async () => {
  const { data } = await supabase.from('errors')
    .select('id')
    .order('failed_at', { ascending: false })
    .range(2000, 999999);
  if (data && data.length > 0) {
    await supabase.from('errors').delete().in('id', data.map(e => e.id));
  }
};

// ── Audit log ─────────────────────────────────────────────────────────────────

export const insertAudit = async (a) => {
  await supabase.from('audit_log').insert({
    user_id: a.userId, user_name: a.userName, action: a.action,
    details: a.details, ip: a.ip, created_at: a.createdAt,
  });
};

export const getAuditLog = async (limit, offset) => {
  const { data } = await supabase.from('audit_log')
    .select('*')
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);
  return data || [];
};

export const getAuditCount = async () => {
  const { count } = await supabase.from('audit_log').select('*', { count: 'exact', head: true });
  return { c: count || 0 };
};

// ── Announcements ─────────────────────────────────────────────────────────────

export const insertAnnouncement = async (a) => {
  await supabase.from('announcements').insert({
    id: a.id, title: a.title, body: a.body, sent_to: a.sentTo,
    recipient_count: a.recipientCount, created_at: a.createdAt,
  });
};

export const getAllAnnouncements = () =>
  all(supabase.from('announcements').select('*').order('created_at', { ascending: false }));

// ── Audit helper ──────────────────────────────────────────────────────────────

export async function audit(userId, userName, action, details, ip) {
  try {
    await insertAudit({
      userId: userId || null, userName: userName || null,
      action, details: details || null, ip: ip || null,
      createdAt: new Date().toISOString(),
    });
  } catch {}
}
