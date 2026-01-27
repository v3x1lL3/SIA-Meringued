// Order view: minimal renderer for recent orders list.

export function renderOrders(containerId, orders) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!orders || orders.length === 0) {
    container.innerHTML = '<p class="text-gray-500">No orders yet.</p>';
    return;
  }

  container.innerHTML = orders
    .map(
      (o) => `
      <div class="border border-gray-200 rounded-xl p-4 flex justify-between items-center">
        <div>
          <div class="font-semibold text-gray-800">${escapeHtml(o.name || 'Order')}</div>
          <div class="text-xs text-gray-500">${escapeHtml(o.status || 'Pending')}</div>
        </div>
        <div class="font-bold text-[#D4AF37]">₱${(o.total_amount || 0).toFixed(2)}</div>
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

