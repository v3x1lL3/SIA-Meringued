// Supplier model: CRUD for suppliers.
import { supabase } from '../core/supabaseClient.js';

const SUPPLIERS = 'suppliers';

export async function listSuppliers() {
  const { data, error } = await supabase.from(SUPPLIERS).select('*').order('created_at', {
    ascending: false,
  });
  if (error) throw error;
  return data ?? [];
}

export async function createSupplier(payload) {
  const { data, error } = await supabase.from(SUPPLIERS).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(id, patch) {
  const { data, error } = await supabase.from(SUPPLIERS).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

