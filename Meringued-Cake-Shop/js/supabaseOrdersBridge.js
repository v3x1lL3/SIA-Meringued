/**
 * Bridge: expose Supabase order sync on window for inline scripts (client + admin).
 * - syncOrderToSupabase(order) → insert and return { id }; checkout waits for this (like Records → DB).
 * - updateOrderInSupabase(supabaseId, patch) → update order; used when admin changes status.
 */
import { insertOrder, updateOrder } from './models/orderModel.js';

export async function syncOrderToSupabase(order) {
  if (!order) return null;
  try {
    return await insertOrder(order);
  } catch (e) {
    console.warn('[supabaseOrdersBridge] syncOrderToSupabase failed', e);
    return null;
  }
}

export async function updateOrderInSupabase(supabaseId, patch) {
  if (!supabaseId) return;
  try {
    await updateOrder(supabaseId, patch);
  } catch (e) {
    console.warn('[supabaseOrdersBridge] updateOrderInSupabase failed', e);
  }
}

window.syncOrderToSupabase = syncOrderToSupabase;
window.updateOrderInSupabase = updateOrderInSupabase;
