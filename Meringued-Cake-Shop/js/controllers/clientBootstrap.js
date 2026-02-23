// Client dashboard bootstrap: ensures the user is authenticated as a customer (or any logged-in user).

import { ensureAuthenticated, handleLogoutRedirectToHome } from './authController.js';

async function init() {
  const session = await ensureAuthenticated(); // any logged-in user
  if (!session) return;

  const { profile } = session;

  // Keep displayed identity and user id in sync (so Order/Logs/Settings are unique per user).
  if (profile?.name) localStorage.setItem('userName', profile.name);
  if (profile?.email) localStorage.setItem('userEmail', profile.email);
  if (session?.user?.id) localStorage.setItem('userId', session.user.id);

  const nameSpan = document.getElementById('customerName');
  const sidebarName = document.getElementById('sidebarCustomerName');
  if (nameSpan && profile?.name) nameSpan.textContent = profile.name;
  if (sidebarName && profile?.name) sidebarName.textContent = profile.name;

  const logoutConfirmBtn = document.querySelector(
    '#logoutModal button[onclick="confirmLogout()"]'
  );
  if (logoutConfirmBtn) {
    logoutConfirmBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await handleLogoutRedirectToHome();
    });
  }
}

init();

