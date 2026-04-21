/**
 * Bridge: load/create/update/delete miscellaneous inventory in Supabase (misc_inventory_items).
 * Exposes window.MiscInventorySupabase = { load, create, update, delete: deleteItem }.
 */
import {
  listMiscInventoryItemsForApp,
  createMiscInventoryItem,
  updateMiscInventoryItem,
  deleteMiscInventoryItem,
} from './models/miscInventoryModel.js';

export async function load() {
  try {
    return await listMiscInventoryItemsForApp();
  } catch (e) {
    console.warn('[admin-misc-inventory-supabase] load failed', e);
    return null;
  }
}

export async function create(item) {
  try {
    return await createMiscInventoryItem(item);
  } catch (e) {
    console.warn('[admin-misc-inventory-supabase] create failed', e);
    return null;
  }
}

export async function update(id, patch) {
  try {
    await updateMiscInventoryItem(id, patch);
  } catch (e) {
    console.warn('[admin-misc-inventory-supabase] update failed', e);
  }
}

export async function deleteItem(id) {
  try {
    return await deleteMiscInventoryItem(id);
  } catch (e) {
    console.warn('[admin-misc-inventory-supabase] delete failed', e);
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

window.MiscInventorySupabase = { load, create, update, delete: deleteItem };
