import { ensureAuthenticated, handleLogoutRedirectToHome } from './authController.js';
import { showToast, showLoadingOverlay, hideLoadingOverlay } from '../core/utils.js';
import { listAdminRecords, upsertAdminRecord, deleteAdminRecord } from '../models/adminRecordsModel.js';

const TYPE_LABEL = {
  eod_inventory_audit: 'EOD Inventory Audit',
  daily_expenses: 'Daily expenses',
  inventory_audit: 'Inventory audit',
  sales_receipts: 'Sales receipts',
  purchase_expenses: 'Purchase expenses',
};

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
  return active?.getAttribute('data-type') || 'eod_inventory_audit';
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
    return;
  }

  empty.classList.add('hidden');
  body.innerHTML = rows
    .map(r => {
      const amount = r.amount == null ? '—' : formatMoney(r.amount);
      const notes = (r.notes || '').trim();
      const notesShort = notes.length > 80 ? notes.slice(0, 80) + '…' : notes;
      return `
        <tr class="border-b border-gray-100 hover:bg-[#FFF8F0]/60">
          <td class="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">${escapeHtml(formatDate(r.record_date))}</td>
          <td class="py-3 px-3 text-sm font-semibold text-gray-800">${escapeHtml(r.title || '')}<div class="text-xs text-gray-400 mt-0.5">${escapeHtml(TYPE_LABEL[r.type] || r.type || '')}${r.ref ? ' • ' + escapeHtml(r.ref) : ''}</div></td>
          <td class="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">${escapeHtml(amount)}</td>
          <td class="py-3 px-3 text-sm text-gray-600">${escapeHtml(notesShort || '—')}</td>
          <td class="py-3 px-3 text-sm">
            <div class="flex gap-2">
              <button class="edit-record px-3 py-2 rounded-lg bg-[#FFF8F0] text-[#B8941E] hover:bg-[#FFEFD6] transition font-semibold" data-id="${escapeHtml(r.id)}">
                <i class="fas fa-edit mr-1"></i>Edit
              </button>
              <button class="delete-record px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition font-semibold" data-id="${escapeHtml(r.id)}">
                <i class="fas fa-trash mr-1"></i>Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

let lastLoaded = [];
let lastSource = 'local';

async function refresh() {
  const type = getActiveType();
  const from = qs('#filterFrom')?.value || '';
  const to = qs('#filterTo')?.value || '';
  const search = qs('#filterSearch')?.value || '';

  showLoadingOverlay('Loading records...');
  const { rows, source } = await listAdminRecords({ type, from: from || undefined, to: to || undefined });
  hideLoadingOverlay();

  lastLoaded = applySearch(rows, search);
  lastSource = source;

  renderRows(lastLoaded);
  const summary = qs('#recordsSummary');
  const src = qs('#recordsSource');
  if (summary) summary.textContent = `${TYPE_LABEL[type] || type}: ${lastLoaded.length} record${lastLoaded.length === 1 ? '' : 's'}`;
  if (src) src.textContent = source === 'supabase' ? 'Source: Supabase' : 'Source: localStorage (Supabase table not configured yet)';
}

function findById(id) {
  return lastLoaded.find(r => r.id === id) || null;
}

async function init() {
  const session = await ensureAuthenticated('admin');
  if (!session) return;

  // Wire logout to real Supabase logout when user confirms (reuse existing helper)
  window.confirmLogout = async function () {
    await handleLogoutRedirectToHome();
  };

  qsa('.records-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.getAttribute('data-type') || 'eod_inventory_audit';
      setActiveTab(type);
      qs('#recordType').value = type;
      await refresh();
    });
  });

  qs('#applyFiltersBtn')?.addEventListener('click', refresh);
  qs('#resetFiltersBtn')?.addEventListener('click', async () => {
    qs('#filterFrom').value = '';
    qs('#filterTo').value = '';
    qs('#filterSearch').value = '';
    await refresh();
  });
  qs('#filterSearch')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      refresh();
    }
  });

  qs('#addRecordBtn')?.addEventListener('click', () => {
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

    if (target.classList.contains('edit-record')) {
      const row = findById(id);
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

  // Default tab
  setActiveTab('eod_inventory_audit');
  await refresh();

  if (lastSource === 'local') {
    showToast('Records page ready (localStorage mode). Run Supabase SQL to sync across devices.', 'info');
  } else {
    showToast('Records page ready (Supabase).', 'info');
  }
}

init();

