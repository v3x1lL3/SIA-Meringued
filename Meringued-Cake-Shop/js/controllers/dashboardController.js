// Dashboard controller: loads summary stats from Supabase and updates the
// existing admin/client dashboard cards.

import { listOrdersForAdmin, listOrdersForCustomer } from '../models/orderModel.js';
import { listCustomers } from '../models/customerModel.js';
import { listLowStock } from '../models/inventoryModel.js';
import { getSessionWithProfile } from '../models/authModel.js';
import { renderAdminSummary, renderClientSummary } from '../views/dashboardView.js';

async function loadAdminDashboard() {
  try {
    // With auth disabled (dev bypass), Supabase may reject queries (no session/RLS). Use empty data so dashboard still loads.
    let orders = [];
    let customers = [];
    let lowStock = [];
    if (typeof SUPABASE_AUTH_DISABLED === 'undefined' || !SUPABASE_AUTH_DISABLED) {
      // Each call fails gracefully (e.g. optional customers table missing) so the dashboard still shows orders/low-stock.
      [orders, customers, lowStock] = await Promise.all([
        listOrdersForAdmin().catch((e) => {
          console.warn('[DashboardController] listOrdersForAdmin failed:', e?.message);
          return [];
        }),
        listCustomers().catch((e) => {
          console.warn('[DashboardController] listCustomers failed:', e?.message);
          return [];
        }),
        listLowStock().catch(() => []),
      ]);
    }

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
    // No toast: partial data (e.g. orders only) is already shown; avoid alarming the user when optional tables are missing.
  }
}

/** Get this user's orders from localStorage when Supabase is unavailable or has no orders table/RLS. */
function getClientOrdersFromStorage() {
  try {
    const key =
      typeof window.getOrdersKey === 'function'
        ? window.getOrdersKey()
        : 'customerOrders_' + (localStorage.getItem('userId') || 'guest');
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    return [];
  }
}

async function loadClientDashboard() {
  try {
    const { user, profile } = await getSessionWithProfile();
    if (!user) return;

    const customerId = profile?.id;
    if (!customerId) return;

    let orders = [];
    if (typeof SUPABASE_AUTH_DISABLED !== 'undefined' && SUPABASE_AUTH_DISABLED) {
      // Dev bypass: use localStorage only.
      orders = getClientOrdersFromStorage();
    } else {
      try {
        orders = await listOrdersForCustomer(customerId);
      } catch (supabaseErr) {
        // Supabase failed (e.g. orders table missing, RLS blocks read). Use localStorage so dashboard still shows your counts.
        console.warn('[DashboardController] Supabase orders failed, using localStorage:', supabaseErr?.message);
        orders = getClientOrdersFromStorage();
      }
    }

    const totalOrders = orders.length;
    const pending = orders.filter((o) =>
      ['Pending', 'Acknowledge', 'Baking'].includes(o.status)
    ).length;
    const completed = orders.filter((o) => o.status === 'Completed').length;

    renderClientSummary({ totalOrders, pending, completed });
  } catch (err) {
    console.error('[DashboardController] Client error:', err);
    // No toast: client already falls back to localStorage for orders; avoid popup when things are otherwise working.
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

