/**
 * Admin dashboard: merge Supabase orders with localStorage, and show today's
 * purchase costs vs sales (from Records) as a small bar chart.
 */
import { fetchMergedOrdersForAdmin } from './admin-orders-merge.js';
import { listAdminRecords } from './models/adminRecordsModel.js';

function getTodayYmdManila() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function sumRecordAmounts(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((s, r) => {
    const n = Number(r?.amount);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function setBarWidth(el, fraction) {
  if (!el) return;
  const pct = Math.round(Math.min(100, Math.max(0, fraction * 100)));
  el.style.width = `${Math.max(pct, 0)}%`;
}

export async function mountFinanceChart() {
  const card = document.getElementById('dashboardTodayFinanceCard');
  if (!card) return;

  const today = getTodayYmdManila();
  let cost = 0;
  let earned = 0;
  let sourceNote = '';

  try {
    const [pRes, sRes] = await Promise.all([
      listAdminRecords({ type: 'purchase_expenses', from: today, to: today }),
      listAdminRecords({ type: 'sales_receipts', from: today, to: today }),
    ]);
    cost = sumRecordAmounts(pRes.rows);
    earned = sumRecordAmounts(sRes.rows);
    const src =
      pRes.source === 'supabase' || sRes.source === 'supabase' ? 'Supabase' : 'local storage';
    sourceNote = `Records source: ${src} • date ${today} (PH)`;
  } catch (e) {
    console.warn('[Dashboard] Finance chart:', e?.message);
    sourceNote = 'Records unavailable';
  }

  const costEl = document.getElementById('dashTodayCostLabel');
  const earnedEl = document.getElementById('dashTodayEarnedLabel');
  const srcEl = document.getElementById('dashFinanceSource');
  const barCost = document.getElementById('dashBarCost');
  const barEarned = document.getElementById('dashBarEarned');

  if (costEl) costEl.textContent = `₱${cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (earnedEl) earnedEl.textContent = `₱${earned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (srcEl) {
    srcEl.textContent = sourceNote;
    srcEl.classList.toggle('hidden', !sourceNote);
  }

  const max = Math.max(cost, earned, 1);
  setBarWidth(barCost, cost / max);
  setBarWidth(barEarned, earned / max);
}

/**
 * Merge remote orders with local (per-user keys + legacy). Updates dashboard via window.applyDashboardOrders.
 */
export async function hydrateAdminDashboard() {
  const mergedResult = await fetchMergedOrdersForAdmin();
  const merged = mergedResult && mergedResult.orders ? mergedResult.orders : mergedResult;

  if (typeof window.applyDashboardOrders === 'function') {
    window.applyDashboardOrders(merged);
  }

  await mountFinanceChart();
}
