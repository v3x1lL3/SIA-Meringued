/**
 * Customers controller: loads and displays logged-in users / customers.
 * - Tries Supabase customers table first (listCustomers).
 * - Then Supabase profiles (users who signed up / logged in).
 * - Fallback: derives customers from localStorage customerOrders (unique names + order counts).
 * - "View orders" shows each customer's orders with full POS details and reference image.
 */

import { listCustomers } from '../models/customerModel.js';
import { listProfiles } from '../models/authModel.js';

const CUSTOMERS_TBODY_ID = 'customersTableBody';
const CUSTOMERS_EMPTY_ID = 'customersEmpty';
const CUSTOMERS_SOURCE_ID = 'customersSource';
const CUSTOMER_ORDERS_MODAL_ID = 'customerOrdersModal';
const CUSTOMER_ORDERS_CONTENT_ID = 'customerOrdersContent';
const CUSTOMER_ORDERS_TITLE_ID = 'customerOrdersTitle';
const RECEIPT_VIEW_MODAL_ID = 'receiptViewModal';
const RECEIPT_VIEW_CONTENT_ID = 'receiptViewContent';
const ORDERS_KEY = 'customerOrders';

/** Orders currently shown in the customer orders modal (for receipt lookup by index). */
let currentCustomerOrders = [];

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text != null ? text : '';
  return div.innerHTML;
}

function getStatusColor(status) {
  const map = {
    Pending: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
    Acknowledge: 'bg-blue-100 text-blue-700 border border-blue-300',
    Baking: 'bg-purple-100 text-purple-700 border border-purple-300',
    Ready: 'bg-green-100 text-green-700 border border-green-300',
    Completed: 'bg-gray-100 text-gray-700 border border-gray-300',
    Cancelled: 'bg-red-100 text-red-700 border border-red-300',
  };
  return map[status] || 'bg-gray-100 text-gray-700 border border-gray-300';
}

/** Get all orders from localStorage. */
function getAllOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/** Get orders that belong to this customer (match by name and optionally email). */
export function getOrdersForCustomer(customerName, customerEmail) {
  const orders = getAllOrders();
  const name = (customerName || '').trim();
  const email = (customerEmail || '').trim();
  return orders.filter((order) => {
    const oName = (order.customer || order.customerName || order.name || '').trim();
    const oEmail = (order.customerEmail || order.email || '').trim();
    const nameMatch = oName === name || (!name && !oName);
    const emailMatch = !email || !oEmail || oEmail === email;
    return nameMatch && emailMatch;
  });
}

/**
 * Build list of unique customers from localStorage customerOrders.
 * Each order may have .customer (name) and we can count orders per customer.
 */
function getCustomersFromOrders() {
  const orders = getAllOrders();
  const byKey = new Map();
  orders.forEach((order) => {
    const name = order.customer || order.customerName || order.name || 'Guest';
    const email = order.customerEmail || order.email || '';
    const key = email ? `${name}|${email}` : name;
    const existing = byKey.get(key);
    const orderDate = order.date || order.created_at || order.dateOrdered || '';
    if (!existing) {
      byKey.set(key, {
        name,
        email,
        orderCount: 1,
        lastOrderDate: orderDate,
      });
    } else {
      existing.orderCount += 1;
      if (orderDate && (!existing.lastOrderDate || orderDate > existing.lastOrderDate)) {
        existing.lastOrderDate = orderDate;
      }
    }
  });
  return Array.from(byKey.values()).sort((a, b) => (b.lastOrderDate || '').localeCompare(a.lastOrderDate || ''));
}

/**
 * Render one order card: what they ordered, quantity, reference image, all details.
 */
function renderOrderCard(order, index) {
  const cake = escapeHtml(order.name || order.cake || 'Custom Order');
  const size = escapeHtml(order.size || 'N/A');
  const qty = order.quantity != null ? order.quantity : 1;
  const flavor = escapeHtml(order.flavor || 'N/A');
  const frosting = escapeHtml(order.frosting || 'N/A');
  const dateNeeded = order.dateNeeded ? new Date(order.dateNeeded).toLocaleDateString() : '—';
  const delivery = escapeHtml(order.deliveryType || 'Pick up');
  const payment = escapeHtml(order.paymentMethod || '—');
  const price = (order.price != null ? order.price : 0).toFixed(2);
  const status = order.status || 'Pending';
  const statusClass = getStatusColor(status);
  const designText = order.cakeDesign ? escapeHtml(order.cakeDesign) : '';
  const hasDesignImage = order.designImage && (order.designImage.startsWith('data:') || order.designImage.startsWith('http'));
  const designImageName = escapeHtml(order.designImageName || 'design.jpg');
  const dedication = order.dedication ? escapeHtml(order.dedication) : '';
  const orderDate = order.date || order.orderGroupId || `#${index + 1}`;
  const hasReceipt = order.receipt && (order.paymentMethod === 'Online Payment' || order.receipt);

  let designBlock = '';
  if (designText || hasDesignImage) {
    designBlock =
      '<div class="bg-[#FFF8F0] rounded-xl p-4 mt-3 border border-[#D4AF37]/20">' +
      '<p class="text-xs text-gray-500 mb-1"><i class="fas fa-palette mr-1 text-[#D4AF37]"></i>Cake design</p>' +
      (designText ? '<p class="text-gray-800 mb-2">' + designText + '</p>' : '') +
      (hasDesignImage
        ? '<p class="text-xs text-gray-500 mb-2"><i class="fas fa-image mr-1"></i>Reference image: ' +
          designImageName +
          '</p><img src="' +
          order.designImage.replace(/"/g, '&quot;') +
          '" alt="Reference" class="max-w-full h-auto max-h-64 rounded-lg shadow border border-gray-200"/>'
        : '') +
      '</div>';
  }
  let dedicationBlock = dedication
    ? '<div class="mt-2 text-sm"><span class="text-gray-500">Dedication:</span> <span class="italic text-gray-700">"' + dedication + '"</span></div>'
    : '';
  const receiptBtn = hasReceipt
    ? '<button type="button" onclick="window.viewReceiptInCustomers(' +
      index +
      ')" class="mt-2 px-3 py-1.5 rounded-lg bg-[#D4AF37]/20 text-[#B8941E] hover:bg-[#D4AF37] hover:text-white text-sm font-medium transition"><i class="fas fa-file-image mr-1"></i>View receipt</button>'
    : '';

  return (
    '<div class="border-2 border-[#D4AF37]/20 rounded-xl p-4 mb-4 bg-white">' +
    '<div class="flex flex-wrap items-center justify-between gap-2 mb-2">' +
    '<span class="font-display font-semibold text-gray-800">' +
    cake +
    '</span>' +
    '<span class="px-2 py-1 rounded-full text-xs font-semibold ' +
    statusClass +
    '">' +
    escapeHtml(status) +
    '</span></div>' +
    '<div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">' +
    '<div><span class="text-gray-500">Size:</span> ' +
    size +
    '</div>' +
    '<div><span class="text-gray-500">Qty:</span> ' +
    qty +
    '</div>' +
    '<div><span class="text-gray-500">Flavor:</span> ' +
    flavor +
    '</div>' +
    '<div><span class="text-gray-500">Frosting:</span> ' +
    frosting +
    '</div>' +
    '<div><span class="text-gray-500">Date needed:</span> ' +
    dateNeeded +
    '</div>' +
    '<div><span class="text-gray-500">Delivery:</span> ' +
    delivery +
    '</div>' +
    (order.deliveryType === 'Deliver' && order.deliveryAddress
      ? '<div class="md:col-span-2"><span class="text-gray-500">Address:</span> <span class="font-medium text-gray-800">' + escapeHtml(order.deliveryAddress) + '</span></div>'
      : '') +
    (order.customerPhone
      ? '<div class="md:col-span-2"><span class="text-gray-500">Contact:</span> <a href="tel:' + escapeHtml(order.customerPhone).replace(/\s/g, '') + '" class="font-medium text-[#D4AF37] hover:underline">' + escapeHtml(order.customerPhone) + '</a></div>'
      : '') +
    '<div><span class="text-gray-500">Payment:</span> ' +
    payment +
    '</div>' +
    '<div><span class="text-gray-500">Order date:</span> ' +
    escapeHtml(String(orderDate)) +
    '</div>' +
    '<div class="md:col-span-2"><span class="text-gray-500">Price:</span> <strong class="text-[#D4AF37]">₱' +
    price +
    '</strong></div>' +
    '</div>' +
    designBlock +
    dedicationBlock +
    receiptBtn +
    '</div>'
  );
}

/** Open modal showing all orders for this customer with full details and reference images. */
export function showCustomerOrders(customerName, customerEmail) {
  const orders = getOrdersForCustomer(customerName, customerEmail);
  currentCustomerOrders = orders;
  const titleEl = document.getElementById(CUSTOMER_ORDERS_TITLE_ID);
  const contentEl = document.getElementById(CUSTOMER_ORDERS_CONTENT_ID);
  const modal = document.getElementById(CUSTOMER_ORDERS_MODAL_ID);
  if (!titleEl || !contentEl || !modal) return;

  const name = (customerName || 'Customer').trim();
  const email = (customerEmail || '').trim();
  titleEl.textContent = 'Orders for ' + name + (email ? ' (' + email + ')' : '');

  if (orders.length === 0) {
    contentEl.innerHTML =
      '<p class="text-gray-500 py-6 text-center">No orders found for this customer in this browser. Orders are stored locally (POS).</p>';
  } else {
    contentEl.innerHTML = orders.map((o, i) => renderOrderCard(o, i)).join('');
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeCustomerOrdersModal() {
  const modal = document.getElementById(CUSTOMER_ORDERS_MODAL_ID);
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = 'auto';
  }
}

/** View receipt image in a modal (used by buttons inside customer orders modal). Index is into currentCustomerOrders. */
export function viewReceiptInCustomers(orderIndex) {
  const order = currentCustomerOrders[orderIndex];
  if (!order || !order.receipt) return;
  const contentEl = document.getElementById(RECEIPT_VIEW_CONTENT_ID);
  const modal = document.getElementById(RECEIPT_VIEW_MODAL_ID);
  if (!contentEl || !modal) return;
  const fileName = order.receiptFileName || 'receipt';
  if (order.receipt.startsWith('data:image/')) {
    contentEl.innerHTML =
      '<p class="text-sm text-gray-600 mb-2"><i class="fas fa-file-image mr-1"></i>' +
      escapeHtml(fileName) +
      '</p><img src="' +
      order.receipt.replace(/"/g, '&quot;') +
      '" alt="Receipt" class="max-w-full h-auto rounded-lg shadow border border-gray-200"/>';
  } else if (order.receipt.startsWith('data:application/pdf')) {
    contentEl.innerHTML =
      '<p class="text-sm text-gray-600 mb-2"><i class="fas fa-file-pdf mr-1"></i>' +
      escapeHtml(fileName) +
      '</p><iframe src="' +
      order.receipt.replace(/"/g, '&quot;') +
      '" class="w-full h-[60vh] rounded-lg border border-gray-200" frameborder="0"></iframe>';
  } else {
    contentEl.innerHTML =
      '<p class="text-sm text-gray-600 mb-2"></p><img src="' +
      order.receipt.replace(/"/g, '&quot;') +
      '" alt="Receipt" class="max-w-full h-auto rounded-lg shadow border border-gray-200"/>';
  }
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeReceiptViewModal() {
  const modal = document.getElementById(RECEIPT_VIEW_MODAL_ID);
  const content = document.getElementById(RECEIPT_VIEW_CONTENT_ID);
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = 'auto';
  }
  if (content) content.innerHTML = '';
}

/**
 * Render customers (array of { name, email?, orderCount?, lastOrderDate?, role?, created_at? }).
 */
function renderCustomers(customers, source) {
  const tbody = document.getElementById(CUSTOMERS_TBODY_ID);
  const emptyEl = document.getElementById(CUSTOMERS_EMPTY_ID);
  const sourceEl = document.getElementById(CUSTOMERS_SOURCE_ID);
  if (!tbody) return;

  if (sourceEl) sourceEl.textContent = source || '';

  if (!customers || customers.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');

  tbody.innerHTML = customers
    .map((c) => {
      const name = c.name ?? c.full_name ?? '—';
      const email = c.email ?? '—';
      const orderCount = c.orderCount != null ? c.orderCount : (c.orders_count != null ? c.orders_count : '—');
      const lastOrder = c.lastOrderDate || c.last_order_at || c.updated_at || c.created_at;
      const lastStr = lastOrder ? new Date(lastOrder).toLocaleDateString() : '—';
      const role = c.role ?? 'customer';
      const nameSafe = String(name).replace(/"/g, '&quot;');
      const emailSafe = String(email).replace(/"/g, '&quot;');
      return (
        '<tr class="border-b border-gray-100 hover:bg-[#FFF8F0]/40 transition">' +
        '<td class="py-3 px-3 font-semibold text-gray-800">' +
        escapeHtml(name) +
        '</td>' +
        '<td class="py-3 px-3 text-gray-700">' +
        escapeHtml(email) +
        '</td>' +
        '<td class="py-3 px-3"><span class="px-2 py-1 rounded-full text-xs font-medium bg-[#D4AF37]/20 text-[#B8941E]">' +
        escapeHtml(String(role)) +
        '</span></td>' +
        '<td class="py-3 px-3 text-gray-700">' +
        escapeHtml(String(orderCount)) +
        '</td>' +
        '<td class="py-3 px-3 text-gray-600 text-sm">' +
        escapeHtml(lastStr) +
        '</td>' +
        '<td class="py-3 px-3">' +
        '<button type="button" data-action="view-orders" data-customer-name="' +
        nameSafe +
        '" data-customer-email="' +
        emailSafe +
        '" class="px-3 py-2 rounded-lg bg-[#D4AF37]/20 text-[#B8941E] hover:bg-[#D4AF37] hover:text-white text-sm font-semibold transition"><i class="fas fa-shopping-bag mr-1"></i>View orders</button>' +
        '</td>' +
        '</tr>'
      );
    })
    .join('');
}

/** Attach delegated click for "View orders" (call once after first render). */
function attachCustomersTableListeners() {
  const tbody = document.getElementById(CUSTOMERS_TBODY_ID);
  if (!tbody || tbody._customersClickAttached) return;
  tbody._customersClickAttached = true;
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="view-orders"]');
    if (!btn) return;
    const n = btn.getAttribute('data-customer-name') || '';
    const em = btn.getAttribute('data-customer-email') || '';
    showCustomerOrders(n, em);
  });
}

export async function loadCustomers() {
  // 1) Try Supabase customers table
  try {
    const customers = await listCustomers();
    if (customers && customers.length > 0) {
      renderCustomers(customers, 'Supabase (customers table)');
      attachCustomersTableListeners();
      exposeCustomerWindowHandlers();
      return;
    }
  } catch (err) {
    console.warn('[CustomersController] listCustomers failed:', err.message);
  }

  // 2) Try Supabase profiles (users who have signed up / logged in)
  try {
    const profiles = await listProfiles();
    if (profiles && profiles.length > 0) {
      const asCustomers = profiles.map((p) => ({
        name: p.name ?? p.full_name ?? '—',
        email: p.email ?? '—',
        role: p.role ?? 'customer',
        created_at: p.created_at,
      }));
      renderCustomers(asCustomers, 'Supabase (profiles – users who signed up)');
      attachCustomersTableListeners();
      exposeCustomerWindowHandlers();
      return;
    }
  } catch (err) {
    console.warn('[CustomersController] listProfiles failed:', err.message);
  }

  // 3) Fallback: from orders in localStorage (users who placed orders / logged-in names)
  const fromOrders = getCustomersFromOrders();
  renderCustomers(
    fromOrders,
    'From orders in this browser (localStorage). Connect Supabase to see all registered users.'
  );
  attachCustomersTableListeners();
  exposeCustomerWindowHandlers();
}

function exposeCustomerWindowHandlers() {
  window.showCustomerOrders = showCustomerOrders;
  window.closeCustomerOrdersModal = closeCustomerOrdersModal;
  window.viewReceiptInCustomers = viewReceiptInCustomers;
  window.closeReceiptViewModal = closeReceiptViewModal;
}
