import { supabase } from '../core/supabaseClient.js';

const TABLE = 'admin_records';
const LS_KEY = 'adminRecords_v1';

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return '';
  }
}

function makeUuid() {
  // Prefer built-in UUID support.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback: manual UUID v4 using crypto.getRandomValues (still browser-safe).
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last resort: should rarely happen, but keep something valid-ish.
  // (Still better than 'sale_...' which definitely fails UUID column.)
  return '00000000-0000-4000-8000-000000000000';
}

function safeParse(json, fallback) {
  try {
    return json ? JSON.parse(json) : fallback;
  } catch {
    return fallback;
  }
}

function loadLocalAll() {
  const raw = localStorage.getItem(LS_KEY);
  const data = safeParse(raw, []);
  return Array.isArray(data) ? data : [];
}

function saveLocalAll(rows) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows || []));
}

/** Map legacy `type` values (e.g. "purchase expenses") to the canonical keys used by tabs. */
function canonicalRecordType(t) {
  const s = String(t || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (s === 'daily_expenses') return 'purchase_expenses';
  return s || String(t || '').trim();
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: canonicalRecordType(row.type),
    record_date: row.record_date,
    title: row.title || '',
    amount: row.amount != null ? Number(row.amount) : null,
    ref: row.ref || '',
    notes: row.notes || '',
    created_at: row.created_at || null,
  };
}

function mapToInsert(payload) {
  // `admin_records.id` is a UUID column. Some bridge payloads generate ids like
  // `sale_<orderId>` which will fail Supabase writes. If it's not a UUID,
  // we generate a proper one so upsert can succeed.
  function isUuidLike(v) {
    const s = String(v || '');
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
  }

  const safeId = payload.id && isUuidLike(payload.id) ? String(payload.id) : makeUuid();
  return {
    id: safeId,
    type: payload.type,
    record_date: payload.record_date,
    title: payload.title || '',
    amount: payload.amount != null && payload.amount !== '' ? Number(payload.amount) : null,
    ref: payload.ref || '',
    notes: payload.notes || '',
    created_at: payload.created_at || nowIso(),
  };
}

function parseRecordDateMs(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const t = Date.parse(`${s}T00:00:00`);
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function parseFilterFromMs(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const t = Date.parse(`${s}T00:00:00`);
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function parseFilterToMs(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const t = Date.parse(`${s}T23:59:59.999`);
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function isYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(s).trim());
}

/** First 10 chars YYYY-MM-DD from record_date (DATE or timestamptz). */
function recordCanonicalYmd(r) {
  if (!r || r.record_date == null) return '';
  const s = String(r.record_date).trim();
  return s.length >= 10 ? s.slice(0, 10) : '';
}

function supabaseErrMessage(e) {
  if (e == null) return '';
  if (typeof e === 'string') return e;
  const m = e.message || e.error_description || e.hint;
  return m ? String(m) : String(e);
}

function supabaseTypeVariants(filterType) {
  const c = canonicalRecordType(filterType);
  const spaced = c.replace(/_/g, ' ');
  const out = new Set([filterType, c, spaced]);
  return [...out].filter(Boolean);
}

async function trySupabaseSelect(filters = {}) {
  let q = supabase.from(TABLE).select('*').order('record_date', { ascending: false }).order('created_at', { ascending: false });
  if (filters.type) {
    const variants = supabaseTypeVariants(filters.type);
    if (variants.length <= 1) q = q.eq('type', variants[0]);
    else q = q.in('type', variants);
  }
  if (filters.from) q = q.gte('record_date', filters.from);
  if (filters.to) q = q.lte('record_date', filters.to);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(normalizeRow).filter(Boolean);
}

async function trySupabaseUpsert(payload) {
  const row = mapToInsert(payload);
  const { data, error } = await supabase.from(TABLE).upsert(row).select('*').single();
  if (error) throw error;
  return normalizeRow(data);
}

async function trySupabaseDelete(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function listAdminRecords(filters = {}) {
  try {
    const rows = await trySupabaseSelect(filters);
    return { rows, source: 'supabase', supabaseError: null };
  } catch (e) {
    try {
      console.warn('[adminRecordsModel] Supabase select failed, using localStorage:', supabaseErrMessage(e));
    } catch (_) {}
    const all = loadLocalAll();
    let rows = all;
    if (filters.type) {
      const want = canonicalRecordType(filters.type);
      rows = rows.filter(r => canonicalRecordType(r.type) === want);
    }
    if (filters.from && filters.to && isYmd(filters.from) && isYmd(filters.to)) {
      const a = String(filters.from).trim();
      const b = String(filters.to).trim();
      rows = rows.filter(r => {
        const y = recordCanonicalYmd(r);
        return y && y >= a && y <= b;
      });
    } else {
      if (filters.from) {
        const fromMs = parseFilterFromMs(filters.from);
        if (fromMs != null) {
          rows = rows.filter(r => {
            const t = parseRecordDateMs(r.record_date);
            return t != null && t >= fromMs;
          });
        }
      }
      if (filters.to) {
        const toMs = parseFilterToMs(filters.to);
        if (toMs != null) {
          rows = rows.filter(r => {
            const t = parseRecordDateMs(r.record_date);
            return t != null && t <= toMs;
          });
        }
      }
    }
    rows = rows
      .slice()
      .sort((a, b) => String(b.record_date || '').localeCompare(String(a.record_date || '')) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return { rows, source: 'local', supabaseError: supabaseErrMessage(e) };
  }
}

export async function upsertAdminRecord(payload) {
  try {
    const row = await trySupabaseUpsert(payload);
    return { row, source: 'supabase' };
  } catch (e) {
    // Helps diagnose RLS / column mismatches from browser console.
    try { console.error('[adminRecordsModel] Supabase upsert failed:', e); } catch (_) {}
    const all = loadLocalAll();
    const row = mapToInsert(payload);
    const idx = all.findIndex(r => r.id === row.id);
    if (idx === -1) all.push(row);
    else all[idx] = { ...all[idx], ...row };
    saveLocalAll(all);
    return { row: normalizeRow(row), source: 'local' };
  }
}

export async function deleteAdminRecord(id) {
  try {
    await trySupabaseDelete(id);
    return { source: 'supabase' };
  } catch (e) {
    const all = loadLocalAll();
    saveLocalAll(all.filter(r => r.id !== id));
    return { source: 'local' };
  }
}

