// Inventory model: basic helpers for inventory tables.

import { supabase } from '../core/supabaseClient.js';

const ITEMS_TABLE = 'inventory_items';

export async function listInventoryItems() {
  const { data, error } = await supabase
    .from(ITEMS_TABLE)
    .select('*')
    .order('reorder_level', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listLowStock(threshold = 5) {
  const { data, error } = await supabase
    .from(ITEMS_TABLE)
    .select('*')
    .lte('quantity', threshold);

  if (error) throw error;
  return data ?? [];
}

/** Map DB row to app shape: id, name, quantity, reorderLevel, unit, imageSrc */
function rowToItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity) ?? 0,
    reorderLevel: Number(row.reorder_level) ?? 0,
    unit: row.unit || 'units',
    imageSrc: row.image_src || '',
  };
}

/** List inventory items in app shape (for admin UI). */
export async function listInventoryItemsForApp() {
  const rows = await listInventoryItems();
  return rows.map(rowToItem);
}

/** Map app item to DB payload (snake_case) */
function itemToRow(item) {
  return {
    name: item.name,
    quantity: Number(item.quantity) ?? 0,
    reorder_level: Number(item.reorderLevel) ?? 0,
    unit: item.unit || 'units',
    image_src: item.imageSrc || null,
  };
}

/**
 * Create one inventory item. Returns created row (app shape) with id.
 * @param {Object} item - { name, quantity, reorderLevel, unit, imageSrc }
 * @returns {Promise<Object|null>} - { id, name, quantity, reorderLevel, unit, imageSrc } or null
 */
export async function createInventoryItem(item) {
  const payload = itemToRow(item);
  const { data, error } = await supabase.from(ITEMS_TABLE).insert(payload).select('*').single();
  if (error) {
    console.warn('[InventoryModel] createInventoryItem failed:', error.message);
    return null;
  }
  return rowToItem(data);
}

/**
 * Update an inventory item by id (Supabase uuid).
 * @param {string} id - uuid
 * @param {Object} patch - e.g. { quantity: 10 }, or { reorder_level, unit, image_src } in snake_case, or reorderLevel in camelCase (we map)
 */
export async function updateInventoryItem(id, patch) {
  const p = {};
  if (patch.quantity != null) p.quantity = Number(patch.quantity);
  if (patch.reorderLevel != null) p.reorder_level = Number(patch.reorderLevel);
  if (patch.reorder_level != null) p.reorder_level = Number(patch.reorder_level);
  if (patch.unit != null) p.unit = patch.unit;
  if (patch.imageSrc != null) p.image_src = patch.imageSrc;
  if (patch.image_src != null) p.image_src = patch.image_src;
  if (Object.keys(p).length === 0) return;
  const { error } = await supabase.from(ITEMS_TABLE).update(p).eq('id', id);
  if (error) console.warn('[InventoryModel] updateInventoryItem failed:', error.message);
}

/**
 * Delete an inventory item by id (Supabase uuid).
 */
export async function deleteInventoryItem(id) {
  const { error } = await supabase.from(ITEMS_TABLE).delete().eq('id', id);
  if (error) console.warn('[InventoryModel] deleteInventoryItem failed:', error.message);
}

/**
 * Get one inventory item by name (case-insensitive). For POS/order-ingredients stock updates.
 * @returns {Promise<{ id, name, quantity, reorder_level, unit }|null>}
 */
export async function getInventoryItemByName(name) {
  if (!name || typeof name !== 'string') return null;
  const { data, error } = await supabase
    .from(ITEMS_TABLE)
    .select('*')
    .ilike('name', name.trim())
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[InventoryModel] getInventoryItemByName failed:', error.message);
    return null;
  }
  return data;
}

/**
 * Apply a quantity delta to an inventory item by name (e.g. -2 to deduct for an order).
 * Used when admin confirms/cancels an order so Supabase stock stays in sync.
 * @param {string} name - Ingredient name (case-insensitive)
 * @param {number} delta - Change in quantity (negative = deduct, positive = restore)
 */
export async function applyQuantityDeltaByName(name, delta) {
  const row = await getInventoryItemByName(name);
  if (!row || row.id == null) return;
  const current = Number(row.quantity) ?? 0;
  const newQty = Math.max(0, current + delta);
  await updateInventoryItem(row.id, { quantity: newQty });
}

