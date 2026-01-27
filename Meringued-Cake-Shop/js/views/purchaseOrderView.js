// Purchase order view: basic list renderer.

export function renderPurchaseOrders(containerId, pos) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!pos || pos.length === 0) {
    container.innerHTML = '<p class="text-gray-500">No purchase orders.</p>';
    return;
  }

  container.innerHTML = pos
    .map(
      (po) => `
        <div class="border border-gray-200 rounded-xl p-4 flex justify-between items-center">
          <div>
            <div class="font-semibold text-gray-800">PO-${escapeHtml(po.id || '')}</div>
            <div class="text-sm text-gray-500">${escapeHtml(po.status || '')}</div>
          </div>
          <div class="font-bold text-[#D4AF37]">₱${(po.total_amount || 0).toFixed(2)}</div>
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

