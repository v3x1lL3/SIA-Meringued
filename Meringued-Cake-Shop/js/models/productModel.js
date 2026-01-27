// Product model: CRUD for products and option tables.
import { supabase } from '../core/supabaseClient.js';

const PRODUCTS = 'products';
const OPTIONS = 'product_options';
const OPTION_VALUES = 'product_option_values';

export async function listProducts() {
  const { data, error } = await supabase.from(PRODUCTS).select('*').order('created_at', {
    ascending: false,
  });
  if (error) throw error;
  return data ?? [];
}

export async function createProduct(payload) {
  const { data, error } = await supabase.from(PRODUCTS).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id, patch) {
  const { data, error } = await supabase.from(PRODUCTS).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function listOptions() {
  const { data, error } = await supabase.from(OPTIONS).select('*').order('sort_order', {
    ascending: true,
  });
  if (error) throw error;
  return data ?? [];
}

export async function listOptionValues(optionId) {
  const query = supabase.from(OPTION_VALUES).select('*');
  if (optionId) query.eq('option_id', optionId);
  const { data, error } = await query.order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

