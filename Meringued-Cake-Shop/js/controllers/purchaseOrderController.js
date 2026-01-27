import { listPurchaseOrders } from '../models/purchaseOrderModel.js';
import { renderPurchaseOrders } from '../views/purchaseOrderView.js';
import { showToast } from '../core/utils.js';

export async function loadPurchaseOrders(containerId) {
  try {
    const pos = await listPurchaseOrders();
    renderPurchaseOrders(containerId, pos);
  } catch (err) {
    console.error('[PurchaseOrderController] loadPurchaseOrders error', err);
    showToast('Failed to load purchase orders.', 'error');
  }
}

