// Supplier view: basic list renderer.

export function renderSuppliers(containerId, suppliers) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!suppliers || suppliers.length === 0) {
    container.innerHTML = '<p class="text-gray-500">No suppliers.</p>';
    return;
  }

  container.innerHTML = suppliers
    .map(
      (s) => `
        <div class="border border-gray-200 rounded-xl p-4">
          <div class="font-semibold text-gray-800">${escapeHtml(s.name || 'Supplier')}</div>
          <div class="text-sm text-gray-500">${escapeHtml(s.contact_person || '')}</div>
          <div class="text-sm text-gray-500">${escapeHtml(s.email || '')}</div>
        </div>
      `
    )
    .join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

