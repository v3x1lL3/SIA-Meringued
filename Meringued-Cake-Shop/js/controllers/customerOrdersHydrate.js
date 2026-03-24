/**
 * Merge Supabase orders into the current customer's localStorage bucket so
 * orders survive logout/login and recover from wrong-key local saves.
 */
import { listOrdersForCustomer } from '../models/orderModel.js';
import { mapSupabaseRowToAppOrder } from '../admin-orders-merge.js';

function mergeCustomerLocalWithCloud(local, cloudMapped) {
  const localBySb = new Map();
  (local || []).forEach((o) => {
    if (o && o.supabase_id != null) localBySb.set(String(o.supabase_id), o);
  });
  const cloudIds = new Set(cloudMapped.map((o) => String(o.supabase_id)));
  const merged = cloudMapped.map((c) => {
    const lo = localBySb.get(String(c.supabase_id));
    if (lo && lo.receipt && (!c.receipt || String(c.receipt).trim() === '')) {
      return {
        ...c,
        receipt: lo.receipt,
        receiptFileName: lo.receiptFileName || c.receiptFileName,
      };
    }
    return c;
  });
  (local || []).forEach((lo) => {
    if (!lo) return;
    if (lo.supabase_id && cloudIds.has(String(lo.supabase_id))) return;
    merged.push(lo);
  });
  return merged;
}

/** Move orders that were saved under customerOrders_guest with this userId into the per-user key. */
function migrateGuestOrdersForUserId(userId) {
  if (!userId || typeof localStorage === 'undefined') return;
  const gk = 'customerOrders_guest';
  let guest;
  try {
    guest = JSON.parse(localStorage.getItem(gk) || '[]');
  } catch (e) {
    return;
  }
  if (!Array.isArray(guest) || guest.length === 0) return;
  const uidStr = String(userId);
  const pull = [];
  const keep = [];
  guest.forEach((o) => {
    if (!o) {
      return;
    }
    if (String(o.userId || '') === uidStr) pull.push(o);
    else keep.push(o);
  });
  if (pull.length === 0) return;
  const userKey = 'customerOrders_' + uidStr;
  let existing;
  try {
    existing = JSON.parse(localStorage.getItem(userKey) || '[]');
  } catch (e) {
    existing = [];
  }
  const seenSb = new Set(
    existing.map((o) => (o && o.supabase_id ? String(o.supabase_id) : null)).filter(Boolean)
  );
  pull.forEach((p) => {
    if (p.supabase_id && seenSb.has(String(p.supabase_id))) return;
    if (p.supabase_id) seenSb.add(String(p.supabase_id));
    existing.push(p);
  });
  localStorage.setItem(userKey, JSON.stringify(existing));
  localStorage.setItem(gk, JSON.stringify(keep));
}

/**
 * Pull orders from Supabase for this auth user and merge into localStorage.
 * @param {string} userId - auth.users id (same as orders.customer_id)
 */
export async function hydrateCustomerOrdersFromSupabase(userId) {
  if (!userId || typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  if (typeof SUPABASE_AUTH_DISABLED !== 'undefined' && SUPABASE_AUTH_DISABLED) return;

  migrateGuestOrdersForUserId(userId);

  const key =
    typeof window.getOrdersKey === 'function'
      ? window.getOrdersKey()
      : 'customerOrders_' + userId;

  let local = [];
  try {
    local = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    local = [];
  }

  let cloudRows = [];
  try {
    cloudRows = await listOrdersForCustomer(userId);
  } catch (e) {
    console.warn('[customerOrdersHydrate] listOrdersForCustomer failed', e?.message || e);
    return;
  }

  if (!Array.isArray(cloudRows) || cloudRows.length === 0) return;

  const cloudMapped = cloudRows.map((row) => mapSupabaseRowToAppOrder(row));
  const merged = mergeCustomerLocalWithCloud(local, cloudMapped);
  try {
    localStorage.setItem(key, JSON.stringify(merged));
  } catch (e) {
    console.warn('[customerOrdersHydrate] localStorage set failed (quota?)', e?.message || e);
  }
}

/** Lets client inline scripts refresh orders after admin updates status (e.g. Completed / Cancelled). */
if (typeof window !== 'undefined') {
  window.hydrateCustomerOrdersFromSupabase = hydrateCustomerOrdersFromSupabase;
}
