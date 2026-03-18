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

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'rec_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
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

function normalizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    record_date: row.record_date,
    title: row.title || '',
    amount: row.amount != null ? Number(row.amount) : null,
    ref: row.ref || '',
    notes: row.notes || '',
    created_at: row.created_at || null,
  };
}

function mapToInsert(payload) {
  return {
    id: payload.id || makeId(),
    type: payload.type,
    record_date: payload.record_date,
    title: payload.title || '',
    amount: payload.amount != null && payload.amount !== '' ? Number(payload.amount) : null,
    ref: payload.ref || '',
    notes: payload.notes || '',
    created_at: payload.created_at || nowIso(),
  };
}

async function trySupabaseSelect(filters = {}) {
  let q = supabase.from(TABLE).select('*').order('record_date', { ascending: false }).order('created_at', { ascending: false });
  if (filters.type) q = q.eq('type', filters.type);
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
    return { rows, source: 'supabase' };
  } catch (e) {
    const all = loadLocalAll();
    let rows = all;
    if (filters.type) rows = rows.filter(r => r.type === filters.type);
    if (filters.from) rows = rows.filter(r => String(r.record_date || '') >= String(filters.from));
    if (filters.to) rows = rows.filter(r => String(r.record_date || '') <= String(filters.to));
    rows = rows
      .slice()
      .sort((a, b) => String(b.record_date || '').localeCompare(String(a.record_date || '')) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return { rows, source: 'local' };
  }
}

export async function upsertAdminRecord(payload) {
  try {
    const row = await trySupabaseUpsert(payload);
    return { row, source: 'supabase' };
  } catch (e) {
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

