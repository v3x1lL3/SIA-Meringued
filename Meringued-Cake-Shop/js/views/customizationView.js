// Customization view: render option groups and values (basic).

export function renderCustomizationOptions(containerId, options, valuesByOptionId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!options || options.length === 0) {
    container.innerHTML = '<p class="text-gray-500">No customization options configured.</p>';
    return;
  }

  container.innerHTML = options
    .map((opt) => {
      const values = valuesByOptionId?.[opt.id] || [];
      const valuesHtml =
        values.length === 0
          ? '<p class="text-xs text-gray-400">No values</p>'
          : values
              .map(
                (v) => `
                  <label class="flex items-center space-x-2 text-sm text-gray-700">
                    <input type="checkbox" data-option="${opt.id}" value="${v.id}" />
                    <span>${escapeHtml(v.label || v.name || 'Option')}</span>
                    <span class="text-[#D4AF37] text-xs">+₱${(v.price_delta || 0).toFixed(2)}</span>
                  </label>
                `
              )
              .join('');

      return `
        <div class="border border-gray-200 rounded-xl p-4 space-y-2">
          <div class="font-semibold text-gray-800">${escapeHtml(opt.label || opt.name || 'Option')}</div>
          <div class="space-y-1">${valuesHtml}</div>
        </div>
      `;
    })
    .join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

