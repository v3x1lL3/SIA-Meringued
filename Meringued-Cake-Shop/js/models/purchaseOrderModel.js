// Purchase Order model: CRUD for purchase orders and items.
import { supabase } from '../core/supabaseClient.js';

const POS = 'purchase_orders';
const PO_ITEMS = 'purchase_order_items';

export async function listPurchaseOrders() {
  const { data, error } = await supabase
    .from(POS)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPurchaseOrder(payload, items = []) {
  const { data, error } = await supabase.from(POS).insert(payload).select().single();
  if (error) throw error;
  const po = data;

  if (items.length > 0) {
    const rows = items.map((item) => ({ ...item, purchase_order_id: po.id }));
    const { error: itemError } = await supabase.from(PO_ITEMS).insert(rows);
    if (itemError) throw itemError;
  }

  return po;
}

