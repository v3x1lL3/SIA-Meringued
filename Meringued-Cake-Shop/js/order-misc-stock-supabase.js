/**
 * Sync baking misc stock-out to Supabase misc_inventory_items (name match).
 * Exposes window.MiscOrderStockSupabase = { applyDeltaByName }.
 */
import { applyMiscQuantityDeltaByName } from './models/miscInventoryModel.js';

export async function applyDeltaByName(name, delta) {
  try {
    await applyMiscQuantityDeltaByName(name, delta);
  } catch (e) {
    console.warn('[order-misc-stock-supabase] applyDeltaByName failed', e);
  }
}

window.MiscOrderStockSupabase = { applyDeltaByName };
