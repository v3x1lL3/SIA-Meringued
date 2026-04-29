/**
 * Shop/business settings shared with customers (pickup phone, address, fees).
 * Stored in Supabase so any browser/incognito session sees admin updates.
 */
import { supabase } from '../core/supabaseClient.js';

const TABLE = 'business_public_settings';
const ROW_ID = 1;

const KEYS_TO_SYNC = [
  'shopPhone',
  'shopAddress',
  'shopLat',
  'shopLng',
  'operatingHours',
  'deliveryFee',
  'minAdvanceDays',
  'minRushDays',
  'notifyLowStock',
];

/**
 * Fetch public row from Supabase (works for anon if RLS allows SELECT).
 * @returns {Promise<object|null>} settings object or null
 */
export async function fetchPublicBusinessSettingsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('settings, updated_at')
      .eq('id', ROW_ID)
      .maybeSingle();

    if (error) {
      console.warn('[shopSettingsModel] fetch failed:', error.message || error);
      return null;
    }
    if (!data || data.settings == null) return null;
    const s = data.settings;
    return typeof s === 'string' ? safeJsonParse(s) : s;
  } catch (e) {
    console.warn('[shopSettingsModel] fetch exception:', e?.message || e);
    return null;
  }
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (_) {
    return null;
  }
}

/**
 * Merge cloud settings into localStorage `adminSettings` (same shape as admin UI).
 */
export async function hydrateShopSettingsToLocalStorage() {
  const cloud = await fetchPublicBusinessSettingsFromSupabase();
  if (!cloud || typeof cloud !== 'object') return;

  let existing = {};
  try {
    existing = JSON.parse(localStorage.getItem('adminSettings') || '{}');
  } catch (_) {
    existing = {};
  }

  const merged = { ...existing };
  KEYS_TO_SYNC.forEach((k) => {
    if (cloud[k] === undefined || cloud[k] === null) return;
    if (typeof cloud[k] === 'string' && cloud[k].trim() === '') return;
    merged[k] = cloud[k];
  });

  try {
    localStorage.setItem('adminSettings', JSON.stringify(merged));
  } catch (e) {
    console.warn('[shopSettingsModel] localStorage merge failed:', e?.message || e);
  }
}

/**
 * Upsert full admin settings object to Supabase (admin session required by RLS).
 * @param {object} settingsObject - same object saved to localStorage adminSettings
 */
export async function upsertPublicBusinessSettingsToSupabase(settingsObject) {
  if (!settingsObject || typeof settingsObject !== 'object') return { ok: false, error: 'invalid' };

  const payload = {
    id: ROW_ID,
    settings: settingsObject,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: 'id' });
  if (error) {
    console.warn('[shopSettingsModel] upsert failed:', error.message || error);
    return { ok: false, error };
  }
  return { ok: true };
}

/**
 * Subscribe to admin updates so customer POS/footer refresh without reload.
 * Enable replication: Supabase Dashboard → Database → Publications → supabase_realtime → add `business_public_settings`.
 */
export function subscribePublicBusinessSettingsChanges(onApplied) {
  const channel = supabase
    .channel(`meringued_business_public_settings_${ROW_ID}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${ROW_ID}` },
      async () => {
        try {
          await hydrateShopSettingsToLocalStorage();
          if (typeof onApplied === 'function') onApplied();
        } catch (e) {
          console.warn('[shopSettingsModel] realtime handler:', e?.message || e);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(
          '[shopSettingsModel] Realtime status:',
          status,
          err?.message || err || '(if updates never arrive, enable replication for business_public_settings)'
        );
      }
    });
  return channel;
}
