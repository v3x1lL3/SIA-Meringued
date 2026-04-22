/**
 * Merge Supabase orders with local (per-user keys + legacy) for admin views.
 */
import { listOrdersForAdmin } from './models/orderModel.js';

function parseDetails(row) {
  const d = row && row.details;
  if (d == null) return {};
  if (typeof d === 'string') {
    try {
      const p = JSON.parse(d);
      return typeof p === 'object' && p !== null ? p : {};
    } catch (_) {
      return {};
    }
  }
  return typeof d === 'object' ? d : {};
}

function nonEmptyReceipt(o) {
  if (!o || o.receipt == null) return false;
  if (typeof o.receipt === 'string') return o.receipt.trim().length > 0;
  return true;
}

/** Pickup → owner_phone; delivery → customer_phone. Legacy rows used customer_phone for shop pickup. */
function resolvePhonesFromRow(row, det) {
  const dt = row.delivery_type || det.deliveryType || 'Pick up';
  const deliver = String(dt).trim().toLowerCase().startsWith('deliver');
  let cust = row.customer_phone != null && row.customer_phone !== '' ? row.customer_phone : det.customerPhone;
  let own = row.owner_phone != null && row.owner_phone !== '' ? row.owner_phone : det.ownerPhone;
  if (!deliver && (own == null || String(own).trim() === '') && cust != null && String(cust).trim() !== '') {
    own = cust;
    cust = null;
  }
  return {
    customerPhone: cust != null && String(cust).trim() !== '' ? cust : null,
    ownerPhone: own != null && String(own).trim() !== '' ? own : null,
  };
}

export function mapSupabaseRowToAppOrder(row) {
  const det = parseDetails(row);
  const localId = det.localId != null ? det.localId : null;
  const phones = resolvePhonesFromRow(row, det);
  const emailFromDet = (det.customerEmail || det.email || '').trim();
  const customerEmail = emailFromDet || null;
  return {
    id: localId != null ? localId : 'sb-' + row.id,
    supabase_id: row.id,
    orderGroupId: det.orderGroupId || String(row.id).slice(0, 8),
    customer: det.customer || null,
    customerEmail,
    email: customerEmail,
    userId: row.customer_id || det.userId || null,
    name: det.name || det.cake || 'Custom Order',
    cake: det.cake || det.name,
    size: det.size || 'Medium',
    quantity: det.quantity != null ? det.quantity : 1,
    dateNeeded: row.date_needed || det.dateNeeded,
    flavor: det.flavor || det.cake,
    frosting: det.frosting || 'Buttercream',
    cakeDesign: det.cakeDesign,
    dedication: det.dedication,
    designImage: det.designImage,
    designImageName: det.designImageName,
    designImages: Array.isArray(det.designImages) ? det.designImages : null,
    deliveryType: row.delivery_type || det.deliveryType || 'Pick up',
    deliveryAddress: row.delivery_address || det.deliveryAddress,
    customerPhone: phones.customerPhone,
    ownerPhone: phones.ownerPhone,
    paymentMethod: row.payment_method || det.paymentMethod || 'Online Payment',
    paymentPlan: det.paymentPlan || null,
    downPaymentAmount: det.downPaymentAmount != null ? det.downPaymentAmount : null,
    receipt: det.receipt || null,
    receiptFileName: det.receiptFileName || null,
    price: row.total_amount != null ? Number(row.total_amount) : det.price || 0,
    status: row.status || 'Pending',
    date: det.date || (row.created_at ? String(row.created_at).slice(0, 10) : ''),
    created_at: row.created_at,
    ingredientsDeducted: det.ingredientsDeducted === true,
  };
}

export async function fetchMergedOrdersForAdmin() {
  const localFn = typeof window !== 'undefined' && typeof window.getAllOrdersForAdmin === 'function'
    ? window.getAllOrdersForAdmin
    : null;
  const local = localFn ? localFn() : [];
  let remote = [];
  try {
    remote = await listOrdersForAdmin();
  } catch (e) {
    console.warn('[admin-orders-merge] listOrdersForAdmin failed:', e && e.message ? e.message : e);
    return { orders: local, source: 'local' };
  }

  console.info('[admin-orders-merge] Supabase returned', remote.length, 'order row(s).');

  // Remote-first: Supabase is source of truth for cloud rows; merge local-only flags (e.g. ingredients).
  const bySb = new Map();
  remote.forEach(function (row) {
    if (!row || !row.id) return;
    bySb.set(String(row.id), mapSupabaseRowToAppOrder(row));
  });

  const localBySb = new Map();
  local.forEach(function (o) {
    if (!o || !o.supabase_id) return;
    localBySb.set(String(o.supabase_id), o);
  });

  bySb.forEach(function (mapped, id) {
    const loc = localBySb.get(id);
    if (loc && loc.ingredientsDeducted === true) {
      mapped.ingredientsDeducted = true;
    }
    // Supabase often omits huge base64 receipts in `details`; browser localStorage still has them.
    if (loc && !nonEmptyReceipt(mapped) && nonEmptyReceipt(loc)) {
      mapped.receipt = loc.receipt;
      if (loc.receiptFileName) mapped.receiptFileName = loc.receiptFileName;
    }
    if (loc) {
      const le = (loc.customerEmail || loc.email || '').trim();
      const me = (mapped.customerEmail || mapped.email || '').trim();
      if (le && !me) {
        mapped.customerEmail = le;
        mapped.email = le;
      }
    }
  });

  // Fallback: match by orderGroupId when supabase_id exists on remote but local copy differs
  bySb.forEach(function (mapped) {
    if (nonEmptyReceipt(mapped)) return;
    const gid = mapped.orderGroupId != null ? String(mapped.orderGroupId) : '';
    if (!gid) return;
    for (let i = 0; i < local.length; i++) {
      const lo = local[i];
      if (!lo || !nonEmptyReceipt(lo)) continue;
      if (String(lo.orderGroupId || '') === gid) {
        mapped.receipt = lo.receipt;
        if (lo.receiptFileName) mapped.receiptFileName = lo.receiptFileName;
        break;
      }
    }
  });

  const merged = Array.from(bySb.values());
  const seenRemoteIds = new Set(bySb.keys());

  // Local rows: only keep orders that were never synced (no supabase_id).
  // If supabase_id is set but that row is gone from the DB, the order was deleted in Supabase —
  // do not re-add it from localStorage (that caused "ghost" orders after Table Editor deletes).
  local.forEach(function (o) {
    if (!o) return;
    if (o.supabase_id) {
      const sid = String(o.supabase_id);
      if (!seenRemoteIds.has(sid)) {
        if (typeof window !== 'undefined' && typeof window.deleteOrderFromAdminStorage === 'function') {
          window.deleteOrderFromAdminStorage(o.id, o.supabase_id);
        }
      }
      return;
    }
    merged.push(o);
  });

  return { orders: dedupeMergedAdminOrders(merged), source: 'supabase' };
}

/**
 * After merge, the same logical order can appear twice: once from Supabase (has supabase_id,
 * id from details.localId) and once as a stale local row with the same id but no supabase_id.
 * Keep the Supabase-backed row; drop the redundant local-only copy.
 */
function dedupeMergedAdminOrders(merged) {
  if (!Array.isArray(merged) || merged.length < 2) return merged;
  const withSb = [];
  const withoutSb = [];
  merged.forEach(function (o) {
    if (!o) return;
    if (o.supabase_id != null && String(o.supabase_id).trim() !== '') withSb.push(o);
    else withoutSb.push(o);
  });
  const result = withSb.slice();
  const idsClaimedByCloud = new Set();
  result.forEach(function (o) {
    if (o.id != null) idsClaimedByCloud.add(String(o.id));
  });
  withoutSb.forEach(function (o) {
    const idStr = o.id != null ? String(o.id) : '';
    if (idStr && idsClaimedByCloud.has(idStr)) return;
    result.push(o);
    if (idStr) idsClaimedByCloud.add(idStr);
  });
  return result;
}
