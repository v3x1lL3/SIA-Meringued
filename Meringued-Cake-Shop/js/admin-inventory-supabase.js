/**
 * Bridge: load/create/update/delete inventory in Supabase for admin-inventory.js.
 * Exposes window.InventorySupabase = { load, create, update, delete: deleteItem }.
 */
import {
  listInventoryItemsForApp,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from './models/inventoryModel.js';

export async function load() {
  try {
    return await listInventoryItemsForApp();
  } catch (e) {
    console.warn('[admin-inventory-supabase] load failed', e);
    // null = unknown; do not treat as empty list (avoids wiping localStorage on refresh).
    return null;
  }
}

export async function create(item) {
  try {
    return await createInventoryItem(item);
  } catch (e) {
    console.warn('[admin-inventory-supabase] create failed', e);
    return null;
  }
}

export async function update(id, patch) {
  try {
    await updateInventoryItem(id, patch);
  } catch (e) {
    console.warn('[admin-inventory-supabase] update failed', e);
  }
}

export async function deleteItem(id) {
  try {
    return await deleteInventoryItem(id);
  } catch (e) {
    console.warn('[admin-inventory-supabase] delete failed', e);
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

window.InventorySupabase = { load, create, update, delete: deleteItem };
