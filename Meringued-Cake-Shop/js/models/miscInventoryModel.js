// Miscellaneous inventory (packaging, supplies) — separate table from baking ingredients.
// No expiry_date: supplies are tracked without expiry in UI and API.

import { supabase } from '../core/supabaseClient.js';

const MISC_TABLE = 'misc_inventory_items';

export async function listMiscInventoryItems() {
  const { data, error } = await supabase
    .from(MISC_TABLE)
    .select('*')
    .order('reorder_level', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Map DB row to app shape (no expiry for misc). */
function rowToItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity) ?? 0,
    reorderLevel: Number(row.reorder_level) ?? 0,
    unit: row.unit || 'units',
    unitCost: Number(row.unit_cost) ?? 0,
    imageSrc: row.image_src || '',
    expiryDate: null,
  };
}

export async function listMiscInventoryItemsForApp() {
  const rows = await listMiscInventoryItems();
  return rows.map(rowToItem);
}

function itemToRow(item) {
  return {
    name: item.name,
    quantity: Number(item.quantity) ?? 0,
    reorder_level: Number(item.reorderLevel) ?? 0,
    unit: item.unit || 'units',
    unit_cost: Number(item.unitCost) ?? 0,
    image_src: item.imageSrc || null,
  };
}

export async function createMiscInventoryItem(item) {
  const payload = itemToRow(item);
  const { data, error } = await supabase.from(MISC_TABLE).insert(payload).select('*').single();
  if (error) {
    console.warn('[MiscInventoryModel] createMiscInventoryItem failed:', error.message);
    return null;
  }
  return rowToItem(data);
}

export async function updateMiscInventoryItem(id, patch) {
  const p = {};
  if (patch.quantity != null) p.quantity = Number(patch.quantity);
  if (patch.reorderLevel != null) p.reorder_level = Number(patch.reorderLevel);
  if (patch.reorder_level != null) p.reorder_level = Number(patch.reorder_level);
  if (patch.unit != null) p.unit = patch.unit;
  if (patch.unitCost != null) p.unit_cost = Number(patch.unitCost);
  if (patch.unit_cost != null) p.unit_cost = Number(patch.unit_cost);
  if (patch.imageSrc != null) p.image_src = patch.imageSrc;
  if (patch.image_src != null) p.image_src = patch.image_src;
  if (Object.keys(p).length === 0) return;
  const { error } = await supabase.from(MISC_TABLE).update(p).eq('id', id);
  if (error) console.warn('[MiscInventoryModel] updateMiscInventoryItem failed:', error.message);
}

export async function deleteMiscInventoryItem(id) {
  const { error } = await supabase.from(MISC_TABLE).delete().eq('id', id);
  if (error) console.warn('[MiscInventoryModel] deleteMiscInventoryItem failed:', error.message);
}

/**
 * Adjust miscellaneous stock by item name (case-insensitive). Used when baking extras deduct misc only.
 * @param {string} name
 * @param {number} delta signed change (negative = stock out)
 */
export async function applyMiscQuantityDeltaByName(name, delta) {
  const rows = await listMiscInventoryItems();
  const nameLower = (name || '').toLowerCase().trim();
  const row = rows.find((r) => (r.name || '').toLowerCase().trim() === nameLower);
  if (!row || row.id == null) return;
  const current = Number(row.quantity) ?? 0;
  const newQty = Math.max(0, current + Number(delta));
  await updateMiscInventoryItem(row.id, { quantity: newQty });
}
