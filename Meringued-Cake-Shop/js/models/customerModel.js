// Customer model: CRUD helpers for the `customers` table.

import { supabase } from '../core/supabaseClient.js';

const TABLE = 'customers';

export async function listCustomers() {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', {
    ascending: false,
  });
  if (error) throw error;
  return data ?? [];
}

export async function createCustomer(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateCustomer(id, patch) {
  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCustomer(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

