import { ensureAuthenticated, handleLogoutRedirectToHome } from './authController.js';
import { showToast, showLoadingOverlay, hideLoadingOverlay } from '../core/utils.js';
import { listAdminRecords, upsertAdminRecord, deleteAdminRecord } from '../models/adminRecordsModel.js';
import { listInventoryItemsForApp } from '../models/inventoryModel.js';

const TYPE_LABEL = {
  eod_inventory_audit: 'EOD inventory',
  inventory_audit: 'Inventory audit',
  sales_receipts: 'Sales receipts',
  purchase_expenses: 'Purchase expenses',
};

/** Remember Records tab so reload + slow EOD init don't snap back to EOD and hide Sales receipts. */
const ADMIN_RECORDS_TAB_KEY = 'adminRecordsActiveTab';
/**
 * Per record-type saved filters in sessionStorage: from, to, search, datePreset ('today' | 'all' | 'custom').
 * On each full page load we reset every tab to datePreset today (Manila); search strings are kept.
 */
const ADMIN_RECORDS_FILTERS_PREFIX = 'adminRecordsFilters_v1_';

function getActiveDatePreset() {
  const active = qs('.records-date-preset-btn.date-preset-active');
  if (active) return active.getAttribute('data-date-preset') || 'today';
  return 'custom';
}

/** @param {'today'|'all'|'custom'} preset */
function setDatePresetUi(preset) {
  qsa('.records-date-preset-btn').forEach(btn => {
    const p = btn.getAttribute('data-date-preset');
    const on = p === preset;
    btn.classList.toggle('date-preset-active', on);
    btn.classList.toggle('bg-[#D4AF37]', on);
    btn.classList.toggle('text-white', on);
    btn.classList.toggle('shadow', on);
    btn.classList.toggle('bg-white', !on);
    btn.classList.toggle('text-gray-700', !on);
    btn.classList.toggle('border-2', !on);
    btn.classList.toggle('border-[#D4AF37]/20', !on);
    btn.classList.toggle('hover:bg-[#FFF8F0]', !on);
  });
}

function saveTabFilters(type) {
  if (!type || !TYPE_LABEL[type]) return;
  const datePreset = getActiveDatePreset();
  let from = qs('#filterFrom')?.value || '';
  let to = qs('#filterTo')?.value || '';
  const search = qs('#filterSearch')?.value || '';
  if (datePreset === 'today') {
    const t = getTodayYmd();
    from = t;
    to = t;
    const ff = qs('#filterFrom');
    const ft = qs('#filterTo');
    if (ff) ff.value = t;
    if (ft) ft.value = t;
  }
  try {
    sessionStorage.setItem(
      ADMIN_RECORDS_FILTERS_PREFIX + type,
      JSON.stringify({ from, to, search, datePreset })
    );
  } catch (_) {
    /* ignore */
  }
}

function loadTabFilters(type) {
  if (!type) return { from: '', to: '', search: '', datePreset: 'today' };
  try {
    const raw = sessionStorage.getItem(ADMIN_RECORDS_FILTERS_PREFIX + type);
    if (raw) {
      const o = JSON.parse(raw);
      const from = o.from != null ? String(o.from) : '';
      const to = o.to != null ? String(o.to) : '';
      const search = o.search != null ? String(o.search) : '';
      let datePreset = o.datePreset;
      if (datePreset !== 'today' && datePreset !== 'all' && datePreset !== 'custom') {
        if (!from && !to) datePreset = 'all';
        else if (from && to && from === to && from === getTodayYmd()) datePreset = 'today';
        else datePreset = 'custom';
      }
      return { from, to, search, datePreset };
    }
  } catch (_) {
    /* ignore */
  }
  return { from: '', to: '', search: '', datePreset: 'today' };
}

function applyTabFiltersToInputs(f) {
  let preset = f.datePreset;
  if (preset !== 'today' && preset !== 'all' && preset !== 'custom') {
    if (!f.from && !f.to) preset = 'all';
    else if (f.from && f.to && f.from === f.to && f.from === getTodayYmd()) preset = 'today';
    else preset = 'custom';
  }
  const ff = qs('#filterFrom');
  const ft = qs('#filterTo');
  const fs = qs('#filterSearch');
  if (preset === 'today') {
    const t = getTodayYmd();
    if (ff) ff.value = t;
    if (ft) ft.value = t;
  } else if (preset === 'all') {
    if (ff) ff.value = '';
    if (ft) ft.value = '';
  } else {
    if (ff) ff.value = f.from || '';
    if (ft) ft.value = f.to || '';
  }
  if (fs) fs.value = f.search || '';
  setDatePresetUi(preset === 'today' || preset === 'all' ? preset : 'custom');
}

function updateRecordsFilterHeading(type) {
  const el = qs('#recordsFilterHeading');
  if (!el) return;
  const label = TYPE_LABEL[type] || 'This list';
  el.textContent = `${label} — date range & search`;
}

/** Purchase & sales use amounts; inventory audit & EOD do not (hide column). */
function recordsAmountColumnVisibleForType(type) {
  return type === 'purchase_expenses' || type === 'sales_receipts';
}

function updateRecordsAmountColumnVisibility() {
  const show = recordsAmountColumnVisibleForType(getActiveType());
  const th = qs('#recordsAmountHeader');
  if (th) th.classList.toggle('hidden', !show);
  qsa('#recordsTableBody td.records-amount-cell').forEach(td => {
    td.classList.toggle('hidden', !show);
  });
}

/** Sum purchase amounts by record_date for rows currently shown (after date + search filters). */
function renderPurchaseDailyTotals(rows, activeType) {
  const wrap = qs('#purchaseDailyTotalsWrap');
  const list = qs('#purchaseDailyTotalsList');
  if (!wrap || !list) return;
  if (activeType !== 'purchase_expenses') {
    wrap.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  const byDay = new Map();
  for (const r of rows) {
    const d = String(r.record_date || '').slice(0, 10);
    if (!d) continue;
    const amt = Number(r.amount);
    const add = Number.isFinite(amt) ? amt : 0;
    byDay.set(d, (byDay.get(d) || 0) + add);
  }
  const days = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a));
  if (days.length === 0) {
    wrap.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  let periodTotal = 0;
  const items = days.map(d => {
    const total = byDay.get(d);
    periodTotal += total;
    return `<li class="flex flex-wrap justify-between gap-2 py-2 border-b border-[#D4AF37]/10 last:border-b-0"><span class="text-gray-700">${escapeHtml(formatDate(d))}</span><span class="font-semibold text-[#B8941E] tabular-nums">₱${formatMoney(total)}</span></li>`;
  });
  let html = items.join('');
  if (days.length > 1) {
    html += `<li class="flex flex-wrap justify-between gap-2 pt-3 mt-1 border-t-2 border-[#D4AF37]/30 font-semibold text-gray-800"><span>Total (this list)</span><span class="text-[#D4AF37] tabular-nums">₱${formatMoney(periodTotal)}</span></li>`;
  }
  list.innerHTML = html;
  wrap.classList.remove('hidden');
}

/** Sum sales receipt amounts by record_date for rows currently shown (after date + search filters). */
function renderSalesDailyTotals(rows, activeType) {
  const wrap = qs('#salesDailyTotalsWrap');
  const list = qs('#salesDailyTotalsList');
  if (!wrap || !list) return;
  if (activeType !== 'sales_receipts') {
    wrap.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  const byDay = new Map();
  for (const r of rows) {
    const d = String(r.record_date || '').slice(0, 10);
    if (!d) continue;
    const amt = Number(r.amount);
    const add = Number.isFinite(amt) ? amt : 0;
    byDay.set(d, (byDay.get(d) || 0) + add);
  }
  const days = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a));
  if (days.length === 0) {
    wrap.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  let periodTotal = 0;
  const items = days.map(d => {
    const total = byDay.get(d);
    periodTotal += total;
    return `<li class="flex flex-wrap justify-between gap-2 py-2 border-b border-emerald-200 last:border-b-0"><span class="text-gray-700">${escapeHtml(formatDate(d))}</span><span class="font-semibold text-emerald-800 tabular-nums">₱${formatMoney(total)}</span></li>`;
  });
  let html = items.join('');
  if (days.length > 1) {
    html += `<li class="flex flex-wrap justify-between gap-2 pt-3 mt-1 border-t-2 border-emerald-300 font-semibold text-gray-800"><span>Total (this list)</span><span class="text-emerald-700 tabular-nums">₱${formatMoney(periodTotal)}</span></li>`;
  }
  list.innerHTML = html;
  wrap.classList.remove('hidden');
}

function restoreRecordsTabFromSession() {
  try {
    const saved = sessionStorage.getItem(ADMIN_RECORDS_TAB_KEY);
    const tab = saved === 'daily_expenses' ? 'purchase_expenses' : saved;
    if (tab && TYPE_LABEL[tab]) {
      setActiveTab(tab);
      const rt = qs('#recordType');
      if (rt) rt.value = tab;
      applyTabFiltersToInputs(loadTabFilters(tab));
      updateRecordsFilterHeading(tab);
      toggleStockFilterForType(tab);
      updateAddRecordButtonForType(tab);
      updateActionsVisibility(tab);
    }
  } catch (_) {
    /* ignore */
  }
}

function qs(sel) {
  return document.querySelector(sel);
}

function qsa(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function formatMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(yyyyMmDd) {
  if (!yyyyMmDd) return '—';
  try {
    const [y, m, d] = String(yyyyMmDd).split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return yyyyMmDd;
  }
}

function openModal() {
  const modal = qs('#recordModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = qs('#recordModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = 'auto';
}

function setActiveTab(type) {
  qsa('.records-tab').forEach(btn => {
    const isActive = btn.getAttribute('data-type') === type;
    btn.classList.toggle('tab-active', isActive);
    btn.classList.toggle('text-gray-500', !isActive);
    btn.classList.toggle('text-[#D4AF37]', isActive);
  });
}

function getActiveType() {
  const active = qsa('.records-tab').find(b => b.classList.contains('tab-active'));
  return active?.getAttribute('data-type') || 'purchase_expenses';
}

function getStockFilter() {
  const el = qs('#stockInOutFilter');
  if (!el || el.classList.contains('hidden')) return 'all';
  const activeBtn = el.querySelector('.stock-filter-btn.active');
  return activeBtn?.getAttribute('data-stock') || 'all';
}

function setStockFilter(stock) {
  const el = qs('#stockInOutFilter');
  if (!el) return;
  el.querySelectorAll('.stock-filter-btn').forEach(btn => {
    const isActive = btn.getAttribute('data-stock') === stock;
    btn.classList.toggle('active', isActive);
    // Lightweight styling switch
    if (isActive) {
      btn.classList.remove('bg-white');
      btn.classList.remove('bg-gray-200');
      btn.classList.add('bg-[#FFF8F0]');
      btn.classList.remove('text-gray-700');
      btn.classList.add('text-[#B8941E]');
      btn.classList.remove('border');
      btn.classList.remove('border-[#D4AF37]/20');
    } else {
      btn.classList.add('bg-white');
      btn.classList.remove('bg-[#FFF8F0]');
      btn.classList.add('text-gray-700');
      btn.classList.remove('text-[#B8941E]');
      btn.classList.add('border');
      btn.classList.add('border-[#D4AF37]/20');
    }
  });
}

function toggleStockFilterForType(type) {
  const el = qs('#stockInOutFilter');
  if (!el) return;
  const shouldShow = type === 'inventory_audit';
  el.classList.toggle('hidden', !shouldShow);
  if (shouldShow) setStockFilter(getStockFilter() || 'all');
}

function applyStockInOutFilter(rows, type) {
  if (type !== 'inventory_audit') return rows;
  const stock = getStockFilter();
  if (!stock || stock === 'all') return rows;

  return rows.filter(r => {
    const titleLc = String(r?.title || '').toLowerCase();
    const notesLc = String(r?.notes || '').toLowerCase();
    const hay = `${titleLc} ${notesLc}`;
    if (stock === 'in') return hay.includes('stock in');
    if (stock === 'out') return hay.includes('stock out');
    return true;
  });
}

function setModalMode(mode, row) {
  const title = qs('#recordModalTitle');
  const delBtn = qs('#deleteRecordBtn');
  const idEl = qs('#recordId');
  if (title) title.innerHTML = `<i class="fas fa-pen mr-2"></i>${mode === 'edit' ? 'Edit record' : 'Add record'}`;
  if (delBtn) delBtn.classList.toggle('hidden', mode !== 'edit');
  if (idEl) idEl.value = row?.id || '';
}

function fillForm(row, typeOverride) {
  const type = typeOverride || row?.type || getActiveType();
  qs('#recordType').value = type;
  qs('#recordDate').value = row?.record_date || new Date().toISOString().slice(0, 10);
  qs('#recordTitle').value = row?.title || '';
  qs('#recordAmount').value = row?.amount != null && row?.amount !== '' ? String(row.amount) : '';
  qs('#recordRef').value = row?.ref || '';
  qs('#recordNotes').value = row?.notes || '';
}

function readForm() {
  return {
    id: qs('#recordId').value || undefined,
    type: qs('#recordType').value,
    record_date: qs('#recordDate').value,
    title: qs('#recordTitle').value.trim(),
    amount: qs('#recordAmount').value,
    ref: qs('#recordRef').value.trim(),
    notes: qs('#recordNotes').value.trim(),
  };
}

function applySearch(rows, search) {
  const q = (search || '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(r => {
    const hay = `${r.title || ''} ${r.ref || ''} ${r.notes || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderRows(rows) {
  const body = qs('#recordsTableBody');
  const empty = qs('#recordsEmpty');
  if (!body || !empty) return;

  if (!rows.length) {
    body.innerHTML = '';
    empty.classList.remove('hidden');
    if (getActiveType() === 'eod_inventory_audit') {
      const h3 = empty.querySelector('h3');
      const p = empty.querySelector('p');
      const btn = empty.querySelector('button');
      if (h3) h3.textContent = 'No EOD inventory in this date range';
      if (p) p.innerHTML = `Use <strong>From / To</strong> above and <strong>Apply</strong> to view another day. Past days stay saved. For each stock in/out line, open <strong>Inventory audit</strong>. Today’s on-hand counts update when you open Records.`;
      if (btn) btn.classList.add('hidden');
    }
    return;
  }

  empty.classList.add('hidden');

  function formatInventoryNotes(notesRaw, showStockLines) {
    const parts = String(notesRaw || '')
      // Notes are stored like: "Stock Out • Δ -0.50 units • New qty: 92.50 units"
      // But spacing may vary, so split on bullet/middot robustly.
      .split(/\s*[•·]\s*/g)
      .map(p => p.trim())
      .filter(Boolean);

    const stockPart = parts.find(p => /^Stock\s+(In|Out)\b/i.test(p));
    const deltaPart = parts.find(p => /^Δ/i.test(p));
    const newQtyPart = parts.find(p => /^New\s*qty:/i.test(p));
    const qtyPart = parts.find(p => /^Qty:/i.test(p));

    const stock = stockPart || '';

    let deltaVal = null;
    let unit = '';
    if (deltaPart) {
      const m = deltaPart.match(/^Δ\s*([+-]?\d+(?:\.\d+)?)\s*(.*)$/i);
      if (m) {
        deltaVal = Number(m[1]);
        unit = (m[2] || '').trim();
      }
    }

    let newQtyVal = null;
    if (newQtyPart) {
      const m = newQtyPart.match(/^New qty:\s*([+-]?\d+(?:\.\d+)?)\s*(.*)$/i);
      if (m) newQtyVal = Number(m[1]);
    }

    let qtyVal = null;
    let qtyUnit = '';
    if (qtyPart) {
      const m = qtyPart.match(/^Qty:\s*([+-]?\d+(?:\.\d+)?)\s*(.*)$/i);
      if (m) {
        qtyVal = Number(m[1]);
        qtyUnit = (m[2] || '').trim();
      }
    }

    if (showStockLines) {
      if (stock && deltaVal != null && newQtyVal != null) {
        const mag = Math.abs(deltaVal).toFixed(2);
        const unitLabel = unit || qtyUnit || 'unit';
        const line1 = `${escapeHtml(stock)} = ${escapeHtml(mag)} ${escapeHtml(unitLabel)}`;
        const line2 = `<div>New Qty: ${escapeHtml(newQtyVal.toFixed(2))}</div>`;
        return `<div>${line1}</div>${line2}`;
      }
      return escapeHtml(notesRaw || '—');
    }

    // EOD: show only qty.
    const valToShow = qtyVal != null ? qtyVal : newQtyVal;
    const unitLabel = qtyUnit || unit || 'unit';
    if (valToShow != null && Number.isFinite(valToShow)) {
      return `<div>Qty: ${escapeHtml(Number(valToShow).toFixed(2))} ${escapeHtml(unitLabel)}</div>`;
    }
    return escapeHtml(notesRaw || '—');
  }

  body.innerHTML = rows
    .map(r => {
      const amount = r.amount == null ? '—' : formatMoney(r.amount);
      let notes = (r.notes || '').trim();
      // Clean up inventory notes: remove verbose "Reason: ..." chunk.
      if (r.type === 'inventory_audit' && notes) {
        notes = notes
          .split(' • ')
          .filter(part => !String(part || '').toLowerCase().startsWith('reason:'))
          .join(' • ');
      }
      // For existing rows where title still contains "Inventory Stock In/Out — X",
      // show only X as title and move Stock In/Out into notes.
      let displayTitle = r.title || '';
      if (r.type === 'inventory_audit') {
        const m = String(r.title || '').match(/Inventory\s+(Stock In|Stock Out)\s*[—-]\s+(.+)$/i);
        if (m) {
          displayTitle = m[2] || r.title || '';
          const stockLabel = m[1];
          const alreadyHasStock = notes.toLowerCase().includes('stock in') || notes.toLowerCase().includes('stock out');
          if (!alreadyHasStock && stockLabel) {
            notes = (stockLabel + (notes ? ' • ' + notes : '')).trim();
          }
        }
      }
      const notesShort = notes.length > 80 ? notes.slice(0, 80) + '…' : notes;

      const typeLabel = TYPE_LABEL[r.type] || r.type || '';
      const isEod = r.type === 'eod_inventory_audit';
      const isLockedType = isEod || r.type === 'inventory_audit';
      const subLine = (r.type === 'inventory_audit' || isEod) ? '' : (typeLabel + (r.ref ? ' • ' + r.ref : ''));
      let notesCell = '—';
      if (r.type === 'inventory_audit') {
        notesCell = formatInventoryNotes(notes, true);
      } else if (r.type === 'eod_inventory_audit') {
        // EOD = on-hand qty for that date; show clean qty line (avoid confusing "Stock In = 0.00" from Δ math).
        notesCell = formatInventoryNotes(notes, false);
      } else if (r.type === 'sales_receipts') {
        // Render "Cake: x • Qty: y • Delivery: z • Payment: m" as clean lines.
        const raw = notesShort || '';
        const parts = String(raw)
          .split(/\s*[•·]\s*/g)
          .map(p => p.trim())
          .filter(Boolean);
        if (parts.length === 0) notesCell = '—';
        else {
          notesCell = `<div class="space-y-0.5">${parts.map(p => `<div>${escapeHtml(p)}</div>`).join('')}</div>`;
        }
      } else {
        notesCell = escapeHtml(notesShort || '—');
      }
      return `
        <tr class="border-b border-gray-100 hover:bg-[#FFF8F0]/60">
          <td class="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">${escapeHtml(formatDate(r.record_date))}</td>
          <td class="py-3 px-3 text-sm font-semibold text-gray-800">${escapeHtml(displayTitle || '')}${subLine ? `<div class="text-xs text-gray-400 mt-0.5">${escapeHtml(subLine)}</div>` : ''}</td>
          <td class="py-3 px-3 text-sm text-gray-700 whitespace-nowrap records-amount-cell">${escapeHtml(amount)}</td>
          <td class="py-3 px-3 text-sm text-gray-600">${notesCell}</td>
          <td class="py-3 px-3 text-sm records-actions-cell">
            ${isLockedType ? '' : `
              <div class="flex gap-2">
                <button class="edit-record px-3 py-2 rounded-lg bg-[#FFF8F0] text-[#B8941E] hover:bg-[#FFEFD6] transition font-semibold" data-id="${escapeHtml(r.id)}">
                  <i class="fas fa-edit mr-1"></i>Edit
                </button>
                <button class="delete-record px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition font-semibold" data-id="${escapeHtml(r.id)}">
                  <i class="fas fa-trash mr-1"></i>Delete
                </button>
              </div>
            `}
          </td>
        </tr>
      `;
    })
    .join('');
}

let lastLoaded = [];
let lastSource = 'local';

async function refresh() {
  const activeType = getActiveType();
  const from = qs('#filterFrom')?.value || '';
  const to = qs('#filterTo')?.value || '';
  const search = qs('#filterSearch')?.value || '';

  showLoadingOverlay('Loading records...');
  // Use filter From/To for all types (including EOD inventory) so you can view yesterday and earlier days.
  // Do NOT overwrite #filterFrom / #filterTo — that broke other tabs' date filters after EOD init.
  const effectiveFrom = from;
  const effectiveTo = to;

  const { rows, source } = await listAdminRecords({
    type: activeType,
    from: effectiveFrom || undefined,
    to: effectiveTo || undefined,
  });
  hideLoadingOverlay();

  const searched = applySearch(rows, search);
  lastLoaded = applyStockInOutFilter(searched, activeType);
  lastSource = source;

  renderRows(lastLoaded);
  updateRecordsAmountColumnVisibility();
  renderPurchaseDailyTotals(lastLoaded, activeType);
  renderSalesDailyTotals(lastLoaded, activeType);
  updateActionsVisibility(activeType);
  const summary = qs('#recordsSummary');
  const src = qs('#recordsSource');
  if (summary) summary.textContent = `${TYPE_LABEL[activeType] || activeType}: ${lastLoaded.length} record${lastLoaded.length === 1 ? '' : 's'}`;
  if (src) src.textContent = source === 'supabase' ? 'Source: Supabase' : 'Source: localStorage (Supabase table not configured yet)';
}

function findById(id) {
  return lastLoaded.find(r => r.id === id) || null;
}

function getTodayYmd() {
  // Use Philippine time so "today" matches Asia/Manila (UTC+8) instead of UTC.
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  } catch {
    // Fallback: local/UTC best-effort (older browsers).
    return new Date().toISOString().slice(0, 10);
  }
}

/** Run on every Records page load: all tabs show today's date range; keep saved search per tab. */
function resetAllRecordsDateFiltersToToday() {
  const today = getTodayYmd();
  for (const type of Object.keys(TYPE_LABEL)) {
    const prev = loadTabFilters(type);
    try {
      sessionStorage.setItem(
        ADMIN_RECORDS_FILTERS_PREFIX + type,
        JSON.stringify({ from: today, to: today, search: prev.search || '', datePreset: 'today' })
      );
    } catch (_) {
      /* ignore */
    }
  }
}

function loadLocalInventoryItemsForEod() {
  const INVENTORY_STORAGE_KEY = 'adminInventoryItems';
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.map(it => ({
      name: String(it?.name || '').trim(),
      quantity: Number(it?.quantity) || 0,
      unit: String(it?.unit || 'units').trim() || 'units',
    })).filter(x => x.name);
  } catch {
    return [];
  }
}

function getNextMidnightManilaMs(now = new Date()) {
  // Asia/Manila is UTC+8 with no DST; we can compute next midnight using a fixed offset.
  const OFFSET_MS = 8 * 60 * 60 * 1000;
  const MANILA_NOW = now.getTime() + OFFSET_MS;
  const NEXT_MANILA_MIDNIGHT = Math.floor(MANILA_NOW / 86400000 + 1) * 86400000;
  return NEXT_MANILA_MIDNIGHT - OFFSET_MS;
}

function scheduleMidnightEodRefresh() {
  const delay = getNextMidnightManilaMs(new Date()) - Date.now();
  const ms = Math.max(1000, delay + 250); // tiny buffer so date flips cleanly
  setTimeout(async () => {
    try {
      await ensureEodAutoSnapshotForToday();
      if (getActiveType() === 'eod_inventory_audit') await refresh();
    } catch {
      // best-effort; don't crash the page
    } finally {
      scheduleMidnightEodRefresh();
    }
  }, ms);
}

async function ensureEodAutoSnapshotForToday() {
  const today = getTodayYmd();
  const eodType = 'eod_inventory_audit';

  // Get existing EOD rows for today (we will update them by UUID, not delete/recreate).
  const existingRes = await listAdminRecords({ type: eodType, from: today, to: today });
  const existingRows = existingRes?.rows || [];
  const existingByTitle = new Map(); // titleKey -> row (latest we see first due to model ordering)
  for (const r of existingRows) {
    if (!r?.title) continue;
    const key = String(r.title).toLowerCase().trim();
    if (!key) continue;
    if (!existingByTitle.has(key)) existingByTitle.set(key, r);
  }

  // Latest inventory movements today (type=`inventory_audit`) used to infer Stock In/Out in EOD notes.
  let movementRows = [];
  try {
    const mvRes = await listAdminRecords({ type: 'inventory_audit', from: today, to: today });
    movementRows = mvRes?.rows || [];
  } catch {
    movementRows = [];
  }

  const lastMovementByTitle = new Map(); // titleKey -> movement row
  for (const r of movementRows) {
    const key = String(r?.title || '').toLowerCase().trim();
    if (!key) continue;
    if (!lastMovementByTitle.has(key)) lastMovementByTitle.set(key, r);
  }

  // Fallback: if movement data is missing, infer direction from yesterday’s EOD qty.
  function getYmdManilaOffset(days) {
    const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  const yesterday = getYmdManilaOffset(-1);
  let yesterdayEodRows = [];
  try {
    const yRes = await listAdminRecords({ type: eodType, from: yesterday, to: yesterday });
    yesterdayEodRows = yRes?.rows || [];
  } catch {
    yesterdayEodRows = [];
  }

  const prevQtyByTitle = new Map();
  for (const r of yesterdayEodRows) {
    if (!r?.title || !r?.notes) continue;
    const key = String(r.title).toLowerCase().trim();
    if (!key) continue;
    const s = String(r.notes);
    const mQty = s.match(/^Qty:\s*([+-]?\d+(?:\.\d+)?)/i);
    const mNew = s.match(/New\s*qty:\s*([+-]?\d+(?:\.\d+)?)/i);
    const val = mQty ? Number(mQty[1]) : (mNew ? Number(mNew[1]) : null);
    if (val != null && Number.isFinite(val) && !prevQtyByTitle.has(key)) prevQtyByTitle.set(key, val);
  }

  function parseMovementNotes(notesRaw, fallbackUnit) {
    const parts = String(notesRaw || '')
      .split(/\s*[•·]\s*/g)
      .map(p => p.trim())
      .filter(Boolean);

    const stockPart = parts.find(p => /^Stock\s+(In|Out)\b/i.test(p));
    const deltaPart = parts.find(p => /^Δ/i.test(p));

    const stockMatch = stockPart ? stockPart.match(/^Stock\s+(In|Out)\b/i) : null;
    const stockLabel = stockMatch
      ? `Stock ${stockMatch[1].charAt(0).toUpperCase()}${stockMatch[1].slice(1).toLowerCase()}`
      : '';

    let deltaVal = null;
    let unitLabel = '';
    if (deltaPart) {
      const m = deltaPart.match(/^Δ\s*([+-]?\d+(?:\.\d+)?)\s*(.*)$/i);
      if (m) {
        deltaVal = Number(m[1]);
        unitLabel = (m[2] || '').trim();
      }
    }

    return {
      stockLabel,
      deltaVal,
      unitLabel: unitLabel || fallbackUnit || 'units',
    };
  }

  // Inventory items source of truth for end-of-day qty.
  let items = [];
  try {
    items = await listInventoryItemsForApp();
  } catch {
    items = [];
  }
  if (!items.length) items = loadLocalInventoryItemsForEod();
  if (!items.length) {
    showToast('EOD inventory: no items found to record.', 'error');
    return;
  }

  let updated = 0;
  for (const item of items) {
    const qty = Number(item?.quantity) || 0;
    const unit = String(item?.unit || 'units').trim() || 'units';
    const title = String(item?.name || '').trim();
    if (!title) continue;

    const titleKey = title.toLowerCase().trim();
    const existingRow = existingByTitle.get(titleKey);
    const existingNotes = String(existingRow?.notes || '').trim();
    const existingHasStock = /^Stock\s+(In|Out)\b/i.test(existingNotes);
    if (existingHasStock) continue;

    const lastMovement = lastMovementByTitle.get(titleKey);

    let notes = `Qty: ${qty.toFixed(2)} ${unit}`;
    if (lastMovement?.notes) {
      const parsed = parseMovementNotes(lastMovement.notes, unit);
      if (parsed.stockLabel && parsed.deltaVal != null && Number.isFinite(parsed.deltaVal)) {
        const abs = Math.abs(parsed.deltaVal).toFixed(2);
        const sign = parsed.deltaVal >= 0 ? '+' : '-';
        const u = parsed.unitLabel || unit;
        notes = [
          parsed.stockLabel,
          `Δ ${sign}${abs} ${u}`,
          `New qty: ${qty.toFixed(2)} ${u}`,
        ].join(' • ');
      }
    }

    // Fallback when movement rows are missing/unparseable.
    if (!/^Stock\s+(In|Out)\b/i.test(notes)) {
      if (prevQtyByTitle.has(titleKey)) {
        const prevQty = prevQtyByTitle.get(titleKey);
        const delta = qty - prevQty;
        if (Number.isFinite(delta)) {
          const stockLabel = delta >= 0 ? 'Stock In' : 'Stock Out';
          const abs = Math.abs(delta).toFixed(2);
          const sign = delta >= 0 ? '+' : '-';
          notes = [
            stockLabel,
            `Δ ${sign}${abs} ${unit}`,
            `New qty: ${qty.toFixed(2)} ${unit}`,
          ].join(' • ');
        }
      }
    }

    await upsertAdminRecord({
      id: existingRow?.id,
      type: eodType,
      record_date: today,
      title,
      amount: null,
      ref: '',
      notes,
    });
    updated += 1;
  }

  if (updated > 0) showToast('EOD inventory updated for today.', 'success');
}

function updateAddRecordButtonForType(type) {
  const btn = qs('#addRecordBtn');
  if (!btn) return;
  const shouldHide = type === 'eod_inventory_audit' || type === 'inventory_audit';
  btn.classList.toggle('hidden', shouldHide);
}

function updateActionsVisibility(type) {
  const header = qs('.records-actions-header');
  const cells = qsa('td.records-actions-cell');
  // User requested: hide Actions everywhere (no Edit/Delete UI).
  const shouldHide = true;
  if (header) header.classList.toggle('hidden', shouldHide);
  cells.forEach(td => td.classList.toggle('hidden', shouldHide));
}

async function init() {
  const session = await ensureAuthenticated('admin');
  if (!session) return;

  resetAllRecordsDateFiltersToToday();

  // Wire logout to real Supabase logout when user confirms (reuse existing helper)
  window.confirmLogout = async function () {
    await handleLogoutRedirectToHome();
  };

  qsa('.records-date-preset-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const preset = btn.getAttribute('data-date-preset') || 'today';
      if (preset === 'today') {
        const t = getTodayYmd();
        const ff = qs('#filterFrom');
        const ft = qs('#filterTo');
        if (ff) ff.value = t;
        if (ft) ft.value = t;
        setDatePresetUi('today');
      } else if (preset === 'all') {
        const ff = qs('#filterFrom');
        const ft = qs('#filterTo');
        if (ff) ff.value = '';
        if (ft) ft.value = '';
        setDatePresetUi('all');
      }
      saveTabFilters(getActiveType());
      await refresh();
    });
  });

  qs('#filterFrom')?.addEventListener('change', () => {
    setDatePresetUi('custom');
  });
  qs('#filterTo')?.addEventListener('change', () => {
    setDatePresetUi('custom');
  });

  qsa('.records-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      const prev = getActiveType();
      const type = btn.getAttribute('data-type') || 'purchase_expenses';
      saveTabFilters(prev);
      try {
        sessionStorage.setItem(ADMIN_RECORDS_TAB_KEY, type);
      } catch (_) {
        /* ignore */
      }
      setActiveTab(type);
      qs('#recordType').value = type;
      applyTabFiltersToInputs(loadTabFilters(type));
      updateRecordsFilterHeading(type);
      toggleStockFilterForType(type);
      updateAddRecordButtonForType(type);
      updateActionsVisibility(type);
      await refresh();
    });
  });

  qs('#applyFiltersBtn')?.addEventListener('click', async () => {
    saveTabFilters(getActiveType());
    await refresh();
  });
  qs('#resetFiltersBtn')?.addEventListener('click', async () => {
    const t = getTodayYmd();
    const ff = qs('#filterFrom');
    const ft = qs('#filterTo');
    const fs = qs('#filterSearch');
    if (ff) ff.value = t;
    if (ft) ft.value = t;
    if (fs) fs.value = '';
    setDatePresetUi('today');
    saveTabFilters(getActiveType());
    setStockFilter('all');
    await refresh();
  });
  qs('#stockInOutFilter')?.querySelectorAll('.stock-filter-btn')?.forEach(btn => {
    btn.addEventListener('click', async () => {
      setStockFilter(btn.getAttribute('data-stock') || 'all');
      await refresh();
    });
  });
  qs('#filterSearch')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTabFilters(getActiveType());
      refresh();
    }
  });

  qs('#addRecordBtn')?.addEventListener('click', () => {
    if (getActiveType() === 'eod_inventory_audit') {
      showToast('EOD inventory is auto-generated — not editable here.', 'info');
      return;
    }
    if (getActiveType() === 'inventory_audit') {
      showToast('Inventory audit records are auto-generated and not editable.', 'info');
      return;
    }
    setModalMode('add');
    fillForm(null, getActiveType());
    openModal();
  });

  qs('#closeRecordModalBtn')?.addEventListener('click', closeModal);
  qs('#cancelRecordBtn')?.addEventListener('click', closeModal);
  qs('#recordModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  qs('#recordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = readForm();
    if (payload.type === 'eod_inventory_audit') {
      showToast('EOD inventory is auto-generated — not editable here.', 'info');
      return;
    }
    if (payload.type === 'inventory_audit') {
      showToast('Inventory audit records are auto-generated and not editable.', 'info');
      return;
    }
    if (!payload.type || !payload.record_date || !payload.title) {
      showToast('Please fill in Type, Date, and Title.', 'error');
      return;
    }
    showLoadingOverlay('Saving...');
    const { source } = await upsertAdminRecord(payload);
    hideLoadingOverlay();
    showToast(source === 'supabase' ? 'Saved to Supabase.' : 'Saved locally (Supabase not ready).', 'success');
    closeModal();
    setActiveTab(payload.type);
    qs('#recordType').value = payload.type;
    applyTabFiltersToInputs(loadTabFilters(payload.type));
    updateRecordsFilterHeading(payload.type);
    toggleStockFilterForType(payload.type);
    updateAddRecordButtonForType(payload.type);
    updateActionsVisibility(payload.type);
    try {
      sessionStorage.setItem(ADMIN_RECORDS_TAB_KEY, payload.type);
    } catch (_) {
      /* ignore */
    }
    await refresh();
  });

  qs('#deleteRecordBtn')?.addEventListener('click', async () => {
    const id = qs('#recordId')?.value;
    if (!id) return;
    if (!confirm('Delete this record?')) return;
    showLoadingOverlay('Deleting...');
    await deleteAdminRecord(id);
    hideLoadingOverlay();
    showToast('Record deleted.', 'success');
    closeModal();
    await refresh();
  });

  qs('#recordsTableBody')?.addEventListener('click', async (e) => {
    const target = e.target?.closest('button');
    if (!target) return;
    const id = target.getAttribute('data-id');
    if (!id) return;

    const row = findById(id);
    if (row?.type === 'eod_inventory_audit') {
      showToast('EOD inventory is auto-generated — not editable here.', 'info');
      return;
    }
    if (row?.type === 'inventory_audit') {
      showToast('Inventory audit records are auto-generated and not editable.', 'info');
      return;
    }

    if (target.classList.contains('edit-record')) {
      if (!row) return;
      setModalMode('edit', row);
      fillForm(row);
      openModal();
      return;
    }

    if (target.classList.contains('delete-record')) {
      if (!confirm('Delete this record?')) return;
      showLoadingOverlay('Deleting...');
      await deleteAdminRecord(id);
      hideLoadingOverlay();
      showToast('Record deleted.', 'success');
      await refresh();
    }
  });

  // Restore last tab (reload) before slow EOD work; after EOD finishes, keep whatever tab the user chose
  // (if they opened Sales receipts while EOD was running, do not force back to EOD).
  restoreRecordsTabFromSession();

  await ensureEodAutoSnapshotForToday();
  scheduleMidnightEodRefresh();

  const activeTab = getActiveType();
  setActiveTab(activeTab);
  const rt = qs('#recordType');
  if (rt) rt.value = activeTab;
  applyTabFiltersToInputs(loadTabFilters(activeTab));
  updateRecordsFilterHeading(activeTab);
  toggleStockFilterForType(activeTab);
  updateAddRecordButtonForType(activeTab);
  updateActionsVisibility(activeTab);
  await refresh();

  if (lastSource === 'local') {
    showToast('Records page ready (localStorage mode). Run Supabase SQL to sync across devices.', 'info');
  } else {
    showToast('Records page ready (Supabase).', 'info');
  }
}

init();

