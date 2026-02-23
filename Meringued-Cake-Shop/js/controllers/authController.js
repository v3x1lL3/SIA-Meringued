// Auth controller: wires login/signup to Supabase Auth.
// This file is loaded as a module from index.html and also provides
// simple guards for admin/client dashboards.
// Enforces separation: Customer sign-in only for customer accounts; Admin sign-in only for admin accounts.

import { showToast, showLoadingOverlay, hideLoadingOverlay } from '../core/utils.js';
import { signUpWithEmail, signInWithEmail, getSessionWithProfile, signOut } from '../models/authModel.js';

function redirectByRole(profile) {
  const role = profile?.role || 'customer';
  window.location.href = role === 'admin' ? 'admindashboard.html' : 'clientdashboard.html';
}

/** Returns true if login intent matches account role; false if mismatch (caller should block and reset). */
function checkLoginIntentMatch(intent, profile) {
  if (!intent || !profile) return true;
  const role = profile.role || 'customer';
  if (intent === 'customer' && role === 'admin') return false;
  if (intent === 'admin' && role !== 'admin') return false;
  return true;
}

async function handleMismatchAndReset(isCustomerIntent, profile) {
  hideLoadingOverlay();
  if (isCustomerIntent) {
    showToast('This account has admin access. Please use the Admin sign-in to access the admin panel.', 'error');
  } else {
    showToast('This account does not have admin access. Contact the administrator to request admin access.', 'error');
  }
  await signOut();
  localStorage.removeItem('userId');
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
  if (typeof window.resetAuthModalToStep1 === 'function') window.resetAuthModalToStep1();
}

async function handleLoginClick() {
  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;

  if (!email || !password) {
    showToast('Please fill in email and password.', 'error');
    return;
  }

  try {
    showLoadingOverlay('Signing you in...');
    const { user, profile } = await signInWithEmail({ email, password });
    hideLoadingOverlay();

    if (user) {
      const intent = window._authLoginIntent;
      if (!checkLoginIntentMatch(intent, profile)) {
        await handleMismatchAndReset(intent === 'customer', profile);
        return;
      }
      // Sync displayed identity and user id so Order/Logs/Settings are unique per user.
      if (profile?.name) localStorage.setItem('userName', profile.name);
      if (profile?.email) localStorage.setItem('userEmail', profile.email);
      if (user.id) localStorage.setItem('userId', user.id);
      showToast('Enter your 6-digit code', 'info');
      // Show 2FA step (demo: any 6 digits accepted; not wired to Supabase).
      window._pendingProfileAfter2FA = profile;
      if (typeof window.show2FAStep === 'function') {
        window.show2FAStep();
      } else {
        redirectByRole(profile);
      }
    }
  } catch (err) {
    hideLoadingOverlay();
    showToast(err.message || 'Login failed.', 'error');
  }
}

/** Called from index.html after user enters 6-digit 2FA code. Completes login redirect (demo: no server validation). */
async function complete2FAAndRedirect() {
  const profile = window._pendingProfileAfter2FA;
  const intent = window._authLoginIntent;
  window._pendingProfileAfter2FA = null;
  if (!profile) return;
  if (!checkLoginIntentMatch(intent, profile)) {
    await handleMismatchAndReset(intent === 'customer', profile);
    return;
  }
  showToast('Welcome back!', 'success');
  redirectByRole(profile);
}
window.complete2FAAndRedirect = complete2FAAndRedirect;

async function handleSignupClick() {
  const fullName = document.getElementById('signupName')?.value.trim();
  const email = document.getElementById('signupEmail')?.value.trim();
  const password = document.getElementById('signupPassword')?.value;
  const confirm = document.getElementById('signupConfirmPassword')?.value;
  const role = (window._authSignupRole === 'admin') ? 'admin' : 'customer';

  if (!fullName || !email || !password || !confirm) {
    showToast('Please fill in all fields.', 'error');
    return;
  }
  if (password !== confirm) {
    showToast('Passwords do not match.', 'error');
    return;
  }

  try {
    showLoadingOverlay('Creating your account...');
    const { user, profile } = await signUpWithEmail({ email, password, fullName, role });
    hideLoadingOverlay();

    if (user) {
      const intent = window._authSignupRole;
      if (!checkLoginIntentMatch(intent, profile)) {
        await handleMismatchAndReset(intent === 'customer', profile);
        return;
      }
      localStorage.setItem('userName', fullName);
      if (profile?.email) localStorage.setItem('userEmail', profile.email);
      if (user.id) localStorage.setItem('userId', user.id);
      showToast('Account created!', 'success');
      redirectByRole(profile);
    }
  } catch (err) {
    hideLoadingOverlay();
    showToast(err.message || 'Signup failed.', 'error');
  }
}

window.handleLogin = handleLoginClick;
window.handleSignup = handleSignupClick;

/** For protected pages: ensure user is logged in (and optionally has required role). */
export async function ensureAuthenticated(requiredRole) {
  const { user, profile } = await getSessionWithProfile();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  if (requiredRole && profile?.role !== requiredRole) {
    window.location.href = 'index.html';
    return null;
  }
  return { user, profile };
}

/** Logout and redirect to home. */
export async function handleLogoutRedirectToHome() {
  await signOut();
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userId');
  window.location.href = 'index.html';
}
