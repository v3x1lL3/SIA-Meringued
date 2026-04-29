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

/** Full instant for `record_date` so admin time filters apply to auto-logged rows. */
function recordTimestampIso() {
  try {
    return new Date().toISOString();
  } catch {
    return ymd();
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

/** Same rule as admin ordering UI — order used 50% down + balance later. */
function isFiftyPercentDownOrder(order) {
  if (!order) return false;
  const pp = String(order.paymentPlan || '');
  const pm = String(order.paymentMethod || '');
  if (/50\s*%/i.test(pm)) return true;
  if (/50\s*%/i.test(pp) && /down/i.test(pp)) return true;
  return false;
}

/**
 * Full order total for accounting. This runs only when the order is marked Completed
 * (pickup/delivery done, balance assumed collected).
 */
function resolveFullSaleAmount(order) {
  const n1 = Number(order.total_amount);
  if (Number.isFinite(n1) && n1 > 0) return n1;
  const n2 = Number(order.price);
  if (Number.isFinite(n2) && n2 > 0) return n2;
  if (isFiftyPercentDownOrder(order) && order.downPaymentAmount != null) {
    const d = Number(order.downPaymentAmount);
    if (Number.isFinite(d) && d > 0) return d * 2;
  }
  return null;
}

export async function logSaleFromOrder(order) {
  if (!order) return;
  const id = makeSaleId(order);
  const title = `Order ${order.orderGroupId || order.supabase_id || order.id || ''}`.trim();
  const fullAmt = resolveFullSaleAmount(order);
  const notesParts = [];
  if (order.name || order.cake) notesParts.push(`Cake: ${order.name || order.cake}`);
  if (order.quantity != null) notesParts.push(`Qty: ${order.quantity}`);
  if (order.deliveryType) notesParts.push(`Delivery: ${order.deliveryType}`);

  if (isFiftyPercentDownOrder(order)) {
    const balMethod = String(order.balancePaymentMethod || '').trim();
    let payLine =
      'Payment: 50% down (customer receipt) + remaining balance — settled when order completed (record on-hand vs online in Orders)';
    if (balMethod === 'online') {
      payLine =
        'Payment: 50% down (customer receipt) + remaining balance paid online at completion (owner proof on order / payment section)';
    } else if (balMethod === 'on_hand') {
      payLine =
        'Payment: 50% down (customer receipt) + remaining balance paid on hand at pickup/delivery';
    }
    notesParts.push(payLine);
    if (fullAmt != null) notesParts.push(`Total sale: ₱${fullAmt.toFixed(2)}`);
    if (order.downPaymentAmount != null && fullAmt != null) {
      const down = Number(order.downPaymentAmount);
      if (Number.isFinite(down)) {
        const bal = Math.max(0, fullAmt - down);
        notesParts.push(`Down payment: ₱${down.toFixed(2)} · Remaining amount: ₱${bal.toFixed(2)}`);
      }
    }
  } else if (order.paymentMethod) {
    notesParts.push(`Payment: ${order.paymentMethod}`);
  }

  const payload = {
    id,
    type: 'sales_receipts',
    record_date: recordTimestampIso(),
    title: title || 'Sale',
    amount: safeMoney(fullAmt ?? order.total_amount ?? order.price),
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
    record_date: recordTimestampIso(),
    title,
    amount: null,
    ref: itemId ? String(itemId) : '',
    notes,
  };
  await upsertAdminRecord(payload);
}

/** Pass linePurchasePrice for g, ml, kg, L: saved amount is one purchase total for this stock-in, not × quantity. */
export async function logPurchaseExpense({
  itemName,
  quantity,
  unit,
  unitCost,
  totalCost,
  ref,
  notes,
  linePurchasePrice = false,
}) {
  if (!itemName) return;
  const priceNote = linePurchasePrice
    ? `Purchase price: ₱${unitCost != null ? Number(unitCost).toFixed(2) : '—'}`
    : `Cost/unit: ₱${unitCost != null ? Number(unitCost).toFixed(2) : '—'}`;
  const payload = {
    type: 'purchase_expenses',
    record_date: recordTimestampIso(),
    title: `Purchase — ${itemName}`,
    amount: Number(totalCost),
    ref: ref != null && String(ref).trim() !== '' ? String(ref).trim() : 'Inventory stock-in',
    notes: [notes || null, `Qty: ${quantity != null ? Number(quantity).toFixed(2) : '—'} ${unit || 'units'}`, priceNote]
      .filter(Boolean)
      .join(' • '),
  };
  await upsertAdminRecord(payload);
}

window.AdminRecords = window.AdminRecords || {};
window.AdminRecords.logSaleFromOrder = logSaleFromOrder;
window.AdminRecords.logInventoryMovement = logInventoryMovement;
window.AdminRecords.logPurchaseExpense = logPurchaseExpense;

