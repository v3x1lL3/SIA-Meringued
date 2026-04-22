// Inventory model: basic helpers for inventory tables.

import { supabase } from '../core/supabaseClient.js';
import { listMiscInventoryItemsForApp } from './miscInventoryModel.js';

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

/** Map DB row to app shape: id, name, quantity, reorderLevel, unit, unitCost, imageSrc, expiryDate */
function rowToItem(row) {
  if (!row) return null;
  let expiryDate = row.expiry_date;
  if (expiryDate && typeof expiryDate === 'object' && typeof expiryDate.getFullYear === 'function') {
    expiryDate = expiryDate.getFullYear() + '-' + String(expiryDate.getMonth() + 1).padStart(2, '0') + '-' + String(expiryDate.getDate()).padStart(2, '0');
  } else if (expiryDate && typeof expiryDate === 'string') {
    expiryDate = expiryDate.slice(0, 10);
  } else {
    expiryDate = null;
  }
  return {
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity) ?? 0,
    reorderLevel: Number(row.reorder_level) ?? 0,
    unit: row.unit || 'units',
    unitCost: Number(row.unit_cost) ?? 0,
    imageSrc: row.image_src || '',
    expiryDate: expiryDate || null,
  };
}

/** List inventory items in app shape (for admin UI). */
export async function listInventoryItemsForApp() {
  const rows = await listInventoryItems();
  return rows.map(rowToItem);
}

/**
 * Ingredients + miscellaneous inventory for EOD snapshots (Records → EOD inventory).
 * Each item includes `eodTitle` (unique row title; misc lines use `[Misc]` if the name matches an ingredient).
 */
export async function listInventoryAndMiscForEod() {
  let ing = [];
  try {
    ing = await listInventoryItemsForApp();
  } catch (e) {
    console.warn('[inventoryModel] EOD: ingredients failed:', e?.message || e);
  }
  let misc = [];
  try {
    misc = await listMiscInventoryItemsForApp();
  } catch (e) {
    console.warn('[inventoryModel] EOD: misc inventory failed:', e?.message || e);
  }
  const ingNames = new Set(ing.map(i => String(i?.name || '').toLowerCase().trim()).filter(Boolean));
  const out = [];
  for (const it of ing) {
    const nm = String(it?.name || '').trim();
    if (!nm) continue;
    out.push({ ...it, eodTitle: nm });
  }
  for (const it of misc) {
    const nm = String(it?.name || '').trim();
    if (!nm) continue;
    const title = ingNames.has(nm.toLowerCase()) ? `${nm} [Misc]` : nm;
    out.push({ ...it, eodTitle: title });
  }
  return out;
}

/** Map app item to DB payload (snake_case) */
function itemToRow(item) {
  return {
    name: item.name,
    quantity: Number(item.quantity) ?? 0,
    reorder_level: Number(item.reorderLevel) ?? 0,
    unit: item.unit || 'units',
    unit_cost: Number(item.unitCost) ?? 0,
    image_src: item.imageSrc || null,
    expiry_date: (item.expiryDate && String(item.expiryDate).slice(0, 10)) || null,
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
  if (patch.unitCost != null) p.unit_cost = Number(patch.unitCost);
  if (patch.unit_cost != null) p.unit_cost = Number(patch.unit_cost);
  if (patch.imageSrc != null) p.image_src = patch.imageSrc;
  if (patch.image_src != null) p.image_src = patch.image_src;
  if (patch.expiryDate !== undefined) p.expiry_date = (patch.expiryDate && String(patch.expiryDate).slice(0, 10)) || null;
  if (patch.expiry_date !== undefined) p.expiry_date = (patch.expiry_date && String(patch.expiry_date).slice(0, 10)) || null;
  if (Object.keys(p).length === 0) return;
  const { error } = await supabase.from(ITEMS_TABLE).update(p).eq('id', id);
  if (error) console.warn('[InventoryModel] updateInventoryItem failed:', error.message);
}

/**
 * Delete an inventory item by id (Supabase uuid).
 */
/** @returns {Promise<{ ok: boolean, error?: string }>} */
export async function deleteInventoryItem(id) {
  const { error } = await supabase.from(ITEMS_TABLE).delete().eq('id', id);
  if (error) {
    console.warn('[InventoryModel] deleteInventoryItem failed:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
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

