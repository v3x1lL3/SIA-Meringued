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

