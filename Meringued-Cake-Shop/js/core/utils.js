// Shared UI and helper utilities used across controllers/views.

/**
 * Show a toast message.
 * This is a simple vanilla implementation that can be styled via Tailwind/utility classes.
 *
 * @param {string} message
 * @param {'success' | 'error' | 'info'} [type='success']
 */
export function showToast(message, type = 'success') {
  let container = document.getElementById('global-toast-container');

  if (!container) {
    container = document.createElement('div');
    container.id = 'global-toast-container';
    container.className =
      'fixed top-4 right-4 z-[9999] flex flex-col gap-3 items-end pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className =
    'pointer-events-auto max-w-sm px-4 py-3 rounded-xl shadow-2xl text-sm font-medium text-white flex items-center gap-3 transition transform translate-x-full opacity-0';

  const base =
    type === 'error'
      ? 'bg-red-500'
      : type === 'info'
      ? 'bg-blue-500'
      : 'bg-emerald-500';

  toast.className += ` ${base}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  // Auto-dismiss
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
      if (!container.hasChildNodes()) {
        container.remove();
      }
    }, 250);
  }, 3000);
}

/**
 * Show/hide a full-screen loading overlay.
 * Call showLoadingOverlay() when starting a long async operation, and hideLoadingOverlay() when done.
 */
export function showLoadingOverlay(label = 'Loading...') {
  if (document.getElementById('global-loading-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'global-loading-overlay';
  overlay.className =
    'fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center';

  overlay.innerHTML = `
    <div class="bg-white rounded-2xl px-8 py-6 flex items-center gap-4 shadow-2xl border border-yellow-200">
      <div class="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      <span class="font-medium text-gray-800">${label}</span>
    </div>
  `;

  document.body.appendChild(overlay);
}

export function hideLoadingOverlay() {
  const overlay = document.getElementById('global-loading-overlay');
  if (overlay) overlay.remove();
}

/**
 * Safely read a form input's value by selector.
 */
export function readInput(selector) {
  const el = document.querySelector(selector);
  return el ? el.value.trim() : '';
}

/**
 * Simple helper to escape text for safe HTML interpolation if needed.
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

