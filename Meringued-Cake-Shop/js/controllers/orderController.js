import { listOrdersForAdmin, listOrdersForCustomer } from '../models/orderModel.js';
import { renderOrders } from '../views/orderView.js';
import { getSessionWithProfile } from '../models/authModel.js';
import { showToast } from '../core/utils.js';

export async function loadAdminOrders(containerId) {
  try {
    const orders = await listOrdersForAdmin();
    renderOrders(containerId, orders);
  } catch (err) {
    console.error('[OrderController] loadAdminOrders error', err);
    showToast('Failed to load orders.', 'error');
  }
}

export async function loadCustomerOrders(containerId) {
  try {
    const { user, profile } = await getSessionWithProfile();
    if (!user || !profile) return;
    const orders = await listOrdersForCustomer(profile.id);
    renderOrders(containerId, orders);
  } catch (err) {
    console.error('[OrderController] loadCustomerOrders error', err);
    showToast('Failed to load your orders.', 'error');
  }
}

