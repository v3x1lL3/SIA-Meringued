/**
 * Classic script at end of body, before deferred modules.
 * Applies localStorage userName immediately to avoid a "Guest" flash when switching pages.
 */
(function () {
  function applyCustomerDisplayName() {
    var display = '';
    try {
      var raw = localStorage.getItem('userName');
      if (raw != null && String(raw).trim()) display = String(raw).trim();
    } catch (e) { /* noop */ }
    var sidebar = document.getElementById('sidebarCustomerName');
    var main = document.getElementById('customerName');
    var text = display || '\u00A0';
    if (sidebar) sidebar.textContent = text;
    if (main) main.textContent = text;
  }
  applyCustomerDisplayName();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCustomerDisplayName);
  }
})();
