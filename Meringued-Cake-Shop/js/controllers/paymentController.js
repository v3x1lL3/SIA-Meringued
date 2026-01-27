import { recordPayment, listPaymentsByOrder } from '../models/paymentModel.js';
import { renderPayments } from '../views/paymentView.js';
import { showToast } from '../core/utils.js';

export async function simulatePayment(orderId, amount) {
  try {
    await recordPayment({
      order_id: orderId,
      amount,
      status: 'paid',
      provider: 'mock',
      provider_ref: `MOCK-${Date.now()}`,
    });
    showToast('Payment recorded (mock).', 'success');
  } catch (err) {
    console.error('[PaymentController] simulatePayment error', err);
    showToast('Failed to record payment.', 'error');
  }
}

export async function loadPayments(containerId, orderId) {
  try {
    const payments = await listPaymentsByOrder(orderId);
    renderPayments(containerId, payments);
  } catch (err) {
    console.error('[PaymentController] loadPayments error', err);
    showToast('Failed to load payments.', 'error');
  }
}

