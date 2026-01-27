// Dashboard controller: loads summary stats from Supabase and updates the
// existing admin/client dashboard cards.

import { showToast } from '../core/utils.js';
import { listOrdersForAdmin, listOrdersForCustomer } from '../models/orderModel.js';
import { listCustomers } from '../models/customerModel.js';
import { listLowStock } from '../models/inventoryModel.js';
import { getSessionWithProfile } from '../models/authModel.js';
import { renderAdminSummary, renderClientSummary } from '../views/dashboardView.js';

async function loadAdminDashboard() {
  try {
    const [orders, customers, lowStock] = await Promise.all([
      listOrdersForAdmin(),
      listCustomers(),
      listLowStock().catch(() => []),
    ]);

    const totalOrders = orders.length;
    const pending = orders.filter((o) => o.status === 'Pending').length;
    const processing = orders.filter((o) =>
      ['Acknowledge', 'Baking'].includes(o.status)
    ).length;
    const completed = orders.filter((o) => o.status === 'Completed').length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const today = orders.filter((o) => (o.created_at || '').slice(0, 10) === todayStr).length;

    const revenue = orders
      .filter((o) => o.status === 'Completed')
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);

    renderAdminSummary({
      totalOrders,
      pending,
      processing,
      completed,
      today,
      revenue,
    });

    console.debug('[DashboardController] Admin customers:', customers.length);
    console.debug('[DashboardController] Admin low stock items:', lowStock.length);
  } catch (err) {
    console.error('[DashboardController] Admin error:', err);
    showToast('Failed to load admin dashboard data from Supabase.', 'error');
  }
}

async function loadClientDashboard() {
  try {
    const { user, profile } = await getSessionWithProfile();
    if (!user) return;

    const customerId = profile?.id;
    if (!customerId) return;

    const orders = await listOrdersForCustomer(customerId);

    const totalOrders = orders.length;
    const pending = orders.filter((o) =>
      ['Pending', 'Acknowledge', 'Baking'].includes(o.status)
    ).length;
    const completed = orders.filter((o) => o.status === 'Completed').length;

    renderClientSummary({ totalOrders, pending, completed });
  } catch (err) {
    console.error('[DashboardController] Client error:', err);
    showToast('Failed to load your dashboard data from Supabase.', 'error');
  }
}

// Auto-detect which dashboard we are on based on body data attribute or title.
const isAdmin = document.title.includes('Admin Dashboard');
const isClient = document.title.includes('My Dashboard');

if (isAdmin) {
  loadAdminDashboard();
}

if (isClient) {
  loadClientDashboard();
}

