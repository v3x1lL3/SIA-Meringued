/**
 * Bridge: expose payments logging on window for admin-ordering.html.
 * Records a row in Supabase `payments` when an order becomes Completed.
 */
import { recordPayment } from './models/paymentModel.js';

function pickOrderIdForPayments(order) {
  // Prefer Supabase UUID if present (most likely matches `payments.order_id`).
  return order?.supabase_id || order?.orderGroupId || order?.id || null;
}

export async function logPaymentFromOrder(order) {
  if (!order) return;
  if (order.status !== 'Completed') return;

  const order_id = pickOrderIdForPayments(order);
  if (!order_id) return;

  const amount = Number(order.total_amount != null ? order.total_amount : order.price || 0);
  if (!Number.isFinite(amount) || amount <= 0) return;

  // Map your app payment method string into the `payments.method` column.
  const method = order.paymentMethod || 'Online Payment';

  // Use a meaningful reference: receipt filename when available, otherwise the group/order id.
  const reference =
    order.receiptFileName ||
    order.supabase_id ||
    order.orderGroupId ||
    String(order.id);

  // Only insert; adminordering.html ensures this runs once when transitioning to Completed.
  await recordPayment({
    order_id,
    amount,
    status: 'paid',
    method,
    reference,
  });
}

window.AdminPayments = window.AdminPayments || {};
window.AdminPayments.logPaymentFromOrder = logPaymentFromOrder;

