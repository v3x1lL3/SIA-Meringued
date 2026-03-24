// Order model: wraps `orders` and `order_items` tables.

import { supabase } from '../core/supabaseClient.js';

const ORDERS_TABLE = 'orders';

export async function listOrdersForAdmin() {
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth && auth.user) {
      console.warn(
        '[OrderModel] listOrdersForAdmin returned 0 rows while signed in. If Table Editor shows orders, check RLS and profiles.role = admin (see SUPABASE-CONNECT-INVENTORY-AND-ORDERS.md).'
      );
    }
  }
  return rows;
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
 * @param {Object} order - { ... cakeDesign, designImage?, designImageName?, designImages?: { dataUrl, name }[], ... }
 * @returns {Object} - row for `orders` including customer_phone (delivery only) and owner_phone (pickup only)
 */
function isDeliverDeliveryType(order) {
  const v = String(order.deliveryType || order.delivery_type || '').trim().toLowerCase();
  return v === 'deliver' || v.startsWith('deliver');
}

function mapOrderToPayload(order) {
  const customerId = order.userId || null;
  const dateNeeded = order.dateNeeded ? (order.dateNeeded.split && order.dateNeeded.split('T')[0]) || order.dateNeeded : null;
  const deliver = isDeliverDeliveryType(order);
  const customerPhone = deliver ? (order.customerPhone || null) : null;
  const ownerPhone = deliver ? null : (order.ownerPhone || null);
  return {
    customer_id: customerId || undefined,
    status: order.status || 'Pending',
    total_amount: order.price != null ? Number(order.price) : null,
    delivery_address: order.deliveryAddress || null,
    customer_phone: customerPhone,
    owner_phone: ownerPhone,
    payment_method: order.paymentMethod || null,
    delivery_type: order.deliveryType || null,
    date_needed: dateNeeded || null,
    details: {
      localId: order.id != null ? order.id : null,
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
      paymentPlan: order.paymentPlan || null,
      downPaymentAmount: order.downPaymentAmount != null ? order.downPaymentAmount : null,
      receipt: order.receipt || null,
      designImage: order.designImage || null,
      designImages:
        Array.isArray(order.designImages) && order.designImages.length > 0 ? order.designImages : null,
      customerPhone: order.customerPhone || null,
      ownerPhone: order.ownerPhone || null,
    },
  };
}

function detailsHasHeavyAttachments(d) {
  if (!d || typeof d !== 'object') return false;
  if (typeof d.receipt === 'string' && d.receipt.trim().length > 0) return true;
  if (typeof d.designImage === 'string' && d.designImage.trim().length > 0) return true;
  if (Array.isArray(d.designImages) && d.designImages.some((x) => x && typeof x.dataUrl === 'string' && x.dataUrl.trim().length > 0))
    return true;
  return false;
}

/** Same row shape without huge base64 fields (receipt / design image(s)) for retry inserts. */
function slimOrderPayloadForInsert(payload) {
  if (!payload || typeof payload.details !== 'object' || payload.details === null) return null;
  const d = { ...payload.details };
  if (!detailsHasHeavyAttachments(d)) return null;
  delete d.receipt;
  delete d.designImage;
  delete d.designImages;
  d.receiptStoredLocallyOnly = true;
  return { ...payload, details: d };
}

/**
 * Insert one order into Supabase. Use for client-placed orders.
 * @param {Object} order - App order object (localStorage shape).
 * @returns {Promise<{ id: string } | null>} - Created row with id, or null on error.
 */
export async function insertOrder(order) {
  if (!order) return null;
  let effective = order;
  if (!effective.userId) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth && auth.user && auth.user.id) {
      effective = { ...order, userId: auth.user.id };
    }
  }

  const payload = mapOrderToPayload(effective);
  const runInsert = async (body) =>
    supabase.from(ORDERS_TABLE).insert(body).select('id').single();

  let { data, error } = await runInsert(payload);
  if (!error) return data;

  console.warn('[OrderModel] insertOrder failed (full payload):', error.code || '', error.message, error.details || '');

  const slim = slimOrderPayloadForInsert(payload);
  if (slim) {
    ({ data, error } = await runInsert(slim));
    if (!error) {
      console.info(
        '[OrderModel] insertOrder: row created without receipt/design image in cloud. Receipt may still exist only in the browser; use Storage for large files.'
      );
      return data;
    }
    console.warn('[OrderModel] insertOrder failed (slim payload):', error.code || '', error.message);
  }

  return null;
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

