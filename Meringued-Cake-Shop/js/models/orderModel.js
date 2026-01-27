// Order model: wraps `orders` and `order_items` tables.

import { supabase } from '../core/supabaseClient.js';

const ORDERS_TABLE = 'orders';

export async function listOrdersForAdmin() {
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listOrdersForCustomer(customerId) {
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getOrderCountsForAdminToday() {
  const { data, error } = await supabase.rpc('orders_admin_summary_today');
  if (error) {
    console.warn('[OrderModel] orders_admin_summary_today RPC failed, falling back:', error.message);
    return null;
  }
  return data;
}

