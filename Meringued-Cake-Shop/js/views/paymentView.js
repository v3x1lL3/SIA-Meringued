// Payment view: basic renderer for payment status/history.

export function renderPayments(containerId, payments) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!payments || payments.length === 0) {
    container.innerHTML = '<p class="text-gray-500">No payments recorded.</p>';
    return;
  }

  container.innerHTML = payments
    .map(
      (p) => `
      <div class="border border-gray-200 rounded-xl p-3 flex justify-between items-center text-sm">
        <div>
          <div class="font-semibold text-gray-800">${escapeHtml(p.provider || 'Payment')}</div>
          <div class="text-gray-500">${escapeHtml(p.status || '')}</div>
        </div>
        <div class="font-bold text-[#D4AF37]">₱${(p.amount || 0).toFixed(2)}</div>
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

