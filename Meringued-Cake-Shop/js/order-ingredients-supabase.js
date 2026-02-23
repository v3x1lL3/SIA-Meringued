/**
 * Bridge: sync order–ingredient stock changes to Supabase (deduct on confirm, restore on cancel).
 * Exposes window.OrderIngredientsSupabase = { applyDeltaByName }.
 * Load on admin ordering page so POS flow updates Supabase inventory.
 */
import { applyQuantityDeltaByName } from './models/inventoryModel.js';

export async function applyDeltaByName(name, delta) {
  try {
    await applyQuantityDeltaByName(name, delta);
  } catch (e) {
    console.warn('[order-ingredients-supabase] applyDeltaByName failed', e);
  }
}

window.OrderIngredientsSupabase = { applyDeltaByName };
