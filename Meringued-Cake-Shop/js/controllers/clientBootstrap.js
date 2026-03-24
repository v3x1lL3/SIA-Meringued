// Client dashboard bootstrap: customer accounts only; sync identity + rehydrate orders from Supabase.

import {
  ensureAuthenticated,
  handleLogoutRedirectToHome,
  persistCustomerIdentityLocal,
} from './authController.js';
import { hydrateCustomerOrdersFromSupabase } from './customerOrdersHydrate.js';

async function init() {
  const session = await ensureAuthenticated('customer');
  if (!session) return;

  const { profile, user } = session;

  persistCustomerIdentityLocal(user, profile);

  await hydrateCustomerOrdersFromSupabase(user.id);

  const displayName =
    (localStorage.getItem('userName') && String(localStorage.getItem('userName')).trim()) || '';
  const nameSpan = document.getElementById('customerName');
  const sidebarName = document.getElementById('sidebarCustomerName');
  if (displayName) {
    if (nameSpan) nameSpan.textContent = displayName;
    if (sidebarName) sidebarName.textContent = displayName;
  }

  // Single logout path: Supabase signOut + clear identity keys (overrides inline confirmLogout on client pages).
  window.confirmLogout = async function confirmLogout() {
    await handleLogoutRedirectToHome();
  };

  window.dispatchEvent(
    new CustomEvent('meringuedClientSessionReady', { detail: { userId: user.id } })
  );
}

await init();
