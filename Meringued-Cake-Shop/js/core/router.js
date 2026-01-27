// Very lightweight hash-based/section-based router.
// Controllers can subscribe to route changes instead of manually reading window.location everywhere.

const listeners = new Set();

/**
 * Get the current route (without the leading #).
 * Example: "#orders" -> "orders"
 */
export function getCurrentRoute() {
  const hash = window.location.hash || '#home';
  return hash.replace(/^#/, '') || 'home';
}

/**
 * Navigate to a route (updates location.hash).
 */
export function navigateTo(route) {
  if (!route.startsWith('#')) {
    window.location.hash = `#${route}`;
  } else {
    window.location.hash = route;
  }
}

/**
 * Subscribe to route changes.
 * Returns an unsubscribe function.
 */
export function onRouteChange(callback) {
  listeners.add(callback);
  // Call immediately with current route so views can initialize
  callback(getCurrentRoute());

  return () => listeners.delete(callback);
}

function notify() {
  const route = getCurrentRoute();
  listeners.forEach((cb) => {
    try {
      cb(route);
    } catch (err) {
      console.error('[Router] route listener error', err);
    }
  });
}

window.addEventListener('hashchange', notify);

