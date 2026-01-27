// Product view: minimal render helpers for product lists.

export function renderProductList(containerId, products) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!products || products.length === 0) {
    container.innerHTML = '<p class="text-gray-500">No products found.</p>';
    return;
  }
  container.innerHTML = products
    .map(
      (p) => `
      <div class="border border-gray-200 rounded-xl p-4 flex justify-between items-start">
        <div>
          <div class="font-semibold text-gray-800">${escapeHtml(p.name || 'Product')}</div>
          <div class="text-sm text-gray-500">${escapeHtml(p.category || '')}</div>
        </div>
        <div class="font-bold text-[#D4AF37]">₱${(p.base_price || 0).toFixed(2)}</div>
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

