// Bridge: expose admin-record logging on window for non-module scripts.
import { upsertAdminRecord } from './models/adminRecordsModel.js';

function ymd(date = new Date()) {
  try {
    // Philippine time (Asia/Manila, UTC+8). Using `toISOString()` is UTC, so it can shift the date.
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function safeMoney(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function makeSaleId(order) {
  const key = order?.supabase_id || order?.orderGroupId || order?.id;
  return key ? `sale_${String(key)}` : `sale_${Date.now()}`;
}

export async function logSaleFromOrder(order) {
  if (!order) return;
  const id = makeSaleId(order);
  const title = `Order ${order.orderGroupId || order.supabase_id || order.id || ''}`.trim();
  const notesParts = [];
  if (order.name || order.cake) notesParts.push(`Cake: ${order.name || order.cake}`);
  if (order.quantity != null) notesParts.push(`Qty: ${order.quantity}`);
  if (order.deliveryType) notesParts.push(`Delivery: ${order.deliveryType}`);
  if (order.paymentMethod) notesParts.push(`Payment: ${order.paymentMethod}`);
  if (order.downPaymentAmount != null) notesParts.push(`50% due now: ₱${order.downPaymentAmount}`);
  const payload = {
    id,
    type: 'sales_receipts',
    record_date: ymd(),
    title: title || 'Sale',
    amount: safeMoney(order.total_amount ?? order.price),
    ref: order.supabase_id ? String(order.supabase_id) : (order.orderGroupId ? String(order.orderGroupId) : ''),
    notes: notesParts.join(' • '),
  };
  await upsertAdminRecord(payload);
}

export async function logInventoryMovement({ itemId, itemName, delta, newQty, unit, reason }) {
  if (!itemName) return;
  const sign = (Number(delta) || 0) >= 0 ? '+' : '';
  const stockLabel = Number(delta) >= 0 ? 'Stock In' : 'Stock Out';
  // Keep title clean (just the item). Stock In/Out goes into notes.
  const title = itemName;
  const notes = [
    stockLabel,
    `Δ ${sign}${Number(delta || 0).toFixed(2)} ${unit || ''}`.trim(),
    `New qty: ${Number(newQty || 0).toFixed(2)} ${unit || ''}`.trim(),
    // Keep notes short/clean. Reason text is noisy in the records table.
  ].filter(Boolean).join(' • ');

  const payload = {
    id: `inv_${itemId || itemName}_${Date.now()}`,
    // Inventory movements are logged under Inventory audit (with time/date),
    // while EOD Inventory Audit is created as an end-of-day snapshot.
    type: 'inventory_audit',
    record_date: ymd(),
    title,
    amount: null,
    ref: itemId ? String(itemId) : '',
    notes,
  };
  await upsertAdminRecord(payload);
}

export async function logPurchaseExpense({ itemName, quantity, unit, unitCost, totalCost, ref, notes }) {
  if (!itemName) return;
  const payload = {
    type: 'purchase_expenses',
    record_date: ymd(),
    title: `Purchase — ${itemName}`,
    amount: Number(totalCost),
    ref: ref != null && String(ref).trim() !== '' ? String(ref).trim() : 'Inventory stock-in',
    notes: [
      notes || null,
      `Qty: ${quantity != null ? Number(quantity).toFixed(2) : '—'} ${unit || 'units'}`,
      `Cost/unit: ₱${unitCost != null ? Number(unitCost).toFixed(2) : '—'}`
    ].filter(Boolean).join(' • '),
  };
  await upsertAdminRecord(payload);
}

window.AdminRecords = window.AdminRecords || {};
window.AdminRecords.logSaleFromOrder = logSaleFromOrder;
window.AdminRecords.logInventoryMovement = logInventoryMovement;
window.AdminRecords.logPurchaseExpense = logPurchaseExpense;

