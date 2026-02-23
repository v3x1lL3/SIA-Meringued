/**
 * Per-user storage keys so Order, Logs, and Settings are unique to each Supabase user.
 * Load this script on client pages before any code that reads/writes customerOrders, cart, or clientSettings.
 */
(function () {
  function uid() {
    return localStorage.getItem('userId') || 'guest';
  }
  window.getOrdersKey = function () {
    return 'customerOrders_' + uid();
  };
  window.getCartKey = function () {
    return 'cart_' + uid();
  };
  window.getSettingsKey = function () {
    return 'clientSettings_' + uid();
  };
})();
