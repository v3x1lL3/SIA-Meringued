// Payment model: basic CRUD for payments.
import { supabase } from '../core/supabaseClient.js';

const PAYMENTS = 'payments';

export async function recordPayment(payload) {
  const { data, error } = await supabase.from(PAYMENTS).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function listPaymentsByOrder(orderId) {
  const { data, error } = await supabase
    .from(PAYMENTS)
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

