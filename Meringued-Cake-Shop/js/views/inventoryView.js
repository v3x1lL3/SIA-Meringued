// Inventory view: minimal renderer for inventory list.

export function renderInventoryList(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = '<p class="text-gray-500">No inventory items.</p>';
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <div class="border border-gray-200 rounded-xl p-4 flex justify-between items-center">
          <div>
            <div class="font-semibold text-gray-800">${escapeHtml(item.name || 'Item')}</div>
            <div class="text-sm text-gray-500">Stock: ${item.quantity ?? 0}</div>
          </div>
          <div class="text-sm ${item.quantity <= (item.reorder_level ?? 0) ? 'text-red-500' : 'text-gray-500'}">
            Reorder at ${item.reorder_level ?? 0}
          </div>
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

