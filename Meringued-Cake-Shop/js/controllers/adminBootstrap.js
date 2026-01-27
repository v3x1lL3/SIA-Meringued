// Admin dashboard bootstrap: ensures the user is authenticated as admin.

import { ensureAuthenticated, handleLogoutRedirectToHome } from './authController.js';
import { showToast } from '../core/utils.js';

async function init() {
  const session = await ensureAuthenticated('admin');
  if (!session) return;

  const { profile } = session;
  const subtitle = document.querySelector(
    '.text-gray-600.text-lg'
  );
  if (subtitle && profile?.name) {
    subtitle.textContent = `Overview of your cake shop, ${profile.name}`;
  }

  // Wire logout button to Supabase logout instead of just redirect.
  const logoutBtn = document.querySelector('button[onclick="openLogoutModal()"]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      const modal = document.getElementById('logoutModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
      }
    });
  }

  const confirmLogoutBtn = document.querySelector(
    '#logoutModal button[onclick="confirmLogout()"]'
  );
  if (confirmLogoutBtn) {
    confirmLogoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await handleLogoutRedirectToHome();
    });
  }

  console.debug('[AdminBootstrap] Admin session ready', session);
  showToast('Admin dashboard loaded.', 'info');
}

init();

