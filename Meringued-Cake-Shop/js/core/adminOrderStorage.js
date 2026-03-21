/**
 * Admin: read all customer orders from per-user keys (customerOrders_*) and update by userId.
 */
(function () {
  var PREFIX = 'customerOrders_';

  function getAllOrdersForAdmin() {
    var orders = [];
    var seen = {};
    function pushUnique(list) {
      if (!Array.isArray(list)) return;
      for (var j = 0; j < list.length; j++) {
        var o = list[j];
        if (!o) continue;
        var id = o.id != null ? String(o.id) : '';
        if (id && seen['id:' + id]) continue;
        if (id) seen['id:' + id] = true;
        orders.push(o);
      }
    }
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) {
        try {
          var list = JSON.parse(localStorage.getItem(k) || '[]');
          pushUnique(list);
        } catch (e) {}
      }
    }
    // Legacy single-bucket key (older client flows)
    try {
      var legacy = JSON.parse(localStorage.getItem('customerOrders') || '[]');
      pushUnique(legacy);
    } catch (e) {}
    return orders;
  }

  function getOrdersKeyForUser(userId) {
    return PREFIX + (userId || 'guest');
  }

  function getOrdersForUser(userId) {
    try {
      return JSON.parse(localStorage.getItem(getOrdersKeyForUser(userId)) || '[]');
    } catch (e) {
      return [];
    }
  }

  /** Update one order (by id). Uses order.userId to target the right key; if missing, searches all keys. */
  function updateOrderInStorage(orderId, patch) {
    var userId = null;
    var orders = null;
    var key = null;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) {
        try {
          var list = JSON.parse(localStorage.getItem(k) || '[]');
          var idx = list.findIndex(function (o) { return o.id === orderId; });
          if (idx !== -1) {
            key = k;
            orders = list;
            for (var prop in patch) if (patch.hasOwnProperty(prop)) orders[idx][prop] = patch[prop];
            localStorage.setItem(key, JSON.stringify(orders));
            return true;
          }
        } catch (e) {}
      }
    }
    return false;
  }

  /** Replace the full orders list for a user (e.g. after cancelling one order). */
  function saveOrdersForUser(userId, orders) {
    localStorage.setItem(getOrdersKeyForUser(userId), JSON.stringify(orders || []));
  }

  /**
   * Remove one order from every customerOrders_* key and legacy customerOrders.
   * Matches by numeric/string id and optionally supabase_id (for merged rows whose id is sb-uuid).
   * @returns {boolean} true if at least one list was changed
   */
  function deleteOrderFromAdminStorage(orderId, supabaseId) {
    var idStr = orderId != null ? String(orderId) : '';
    var sbStr = supabaseId != null ? String(supabaseId) : '';
    var removed = false;
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) keys.push(k);
    }
    function shouldRemove(o) {
      if (!o) return false;
      if (idStr && String(o.id) === idStr) return true;
      if (sbStr && o.supabase_id != null && String(o.supabase_id) === sbStr) return true;
      return false;
    }
    keys.forEach(function (k) {
      try {
        var list = JSON.parse(localStorage.getItem(k) || '[]');
        if (!Array.isArray(list)) return;
        var nu = list.filter(function (o) { return !shouldRemove(o); });
        if (nu.length < list.length) {
          removed = true;
          localStorage.setItem(k, JSON.stringify(nu));
        }
      } catch (e) {}
    });
    try {
      var legacy = JSON.parse(localStorage.getItem('customerOrders') || '[]');
      if (Array.isArray(legacy)) {
        var nu2 = legacy.filter(function (o) { return !shouldRemove(o); });
        if (nu2.length < legacy.length) {
          removed = true;
          localStorage.setItem('customerOrders', JSON.stringify(nu2));
        }
      }
    } catch (e) {}
    return removed;
  }

  /** Remove all orders from all per-user keys and legacy `customerOrders`. */
  function clearAllOrdersForAdmin() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) keys.push(k);
    }
    keys.forEach(function (k) { localStorage.removeItem(k); });
    try {
      localStorage.removeItem('customerOrders');
    } catch (e) {}
  }

  window.getAllOrdersForAdmin = getAllOrdersForAdmin;
  window.getOrdersKeyForUser = getOrdersKeyForUser;
  window.getOrdersForUser = getOrdersForUser;
  window.updateOrderInStorage = updateOrderInStorage;
  window.saveOrdersForUser = saveOrdersForUser;
  window.clearAllOrdersForAdmin = clearAllOrdersForAdmin;
  window.deleteOrderFromAdminStorage = deleteOrderFromAdminStorage;
})();
