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

/**
 * Map app order (localStorage shape) to Supabase orders row.
 * @param {Object} order - { customer, name, size, quantity, dateNeeded, flavor, frosting, deliveryType, paymentMethod, price, status, userId, deliveryAddress, customerPhone, receipt, receiptFileName, dedication, cakeDesign, designImage, designImageName, ... }
 * @returns {Object} - { customer_id, status, total_amount, delivery_address, customer_phone, payment_method, delivery_type, date_needed, details }
 */
function mapOrderToPayload(order) {
  const customerId = order.userId || null;
  const dateNeeded = order.dateNeeded ? (order.dateNeeded.split && order.dateNeeded.split('T')[0]) || order.dateNeeded : null;
  return {
    customer_id: customerId || undefined,
    status: order.status || 'Pending',
    total_amount: order.price != null ? Number(order.price) : null,
    delivery_address: order.deliveryAddress || null,
    customer_phone: order.customerPhone || null,
    payment_method: order.paymentMethod || null,
    delivery_type: order.deliveryType || null,
    date_needed: dateNeeded || null,
    details: {
      orderGroupId: order.orderGroupId,
      customer: order.customer,
      name: order.name,
      cake: order.cake,
      size: order.size,
      quantity: order.quantity,
      flavor: order.flavor,
      frosting: order.frosting,
      cakeDesign: order.cakeDesign,
      dedication: order.dedication,
      receiptFileName: order.receiptFileName,
      designImageName: order.designImageName,
      date: order.date,
      receipt: order.receipt || null,
      designImage: order.designImage || null,
    },
  };
}

/**
 * Insert one order into Supabase. Use for client-placed orders.
 * @param {Object} order - App order object (localStorage shape).
 * @returns {Promise<{ id: string } | null>} - Created row with id, or null on error.
 */
export async function insertOrder(order) {
  const payload = mapOrderToPayload(order);
  const { data, error } = await supabase.from(ORDERS_TABLE).insert(payload).select('id').single();
  if (error) {
    console.warn('[OrderModel] insertOrder failed:', error.message);
    return null;
  }
  return data;
}

/**
 * Update an order in Supabase (e.g. status change by admin).
 * @param {string} id - Supabase order uuid.
 * @param {Object} patch - e.g. { status: 'Acknowledge' }
 */
export async function updateOrder(id, patch) {
  const { error } = await supabase.from(ORDERS_TABLE).update(patch).eq('id', id);
  if (error) console.warn('[OrderModel] updateOrder failed:', error.message);
}

