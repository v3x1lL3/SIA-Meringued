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

/**
 * Keep userName / userEmail / userId in localStorage for customer pages (early script + per-user keys).
 * Works for new signups, existing accounts, and profiles where full_name was never set (email prefix fallback).
 * @param {object} user - { id }
 * @param {object} profile - { name, email } from auth metadata
 * @param {string} [signupFullName] - raw name from signup form (strongest when metadata lags)
 */
export function persistCustomerIdentityLocal(user, profile, signupFullName) {
  if (!user || !user.id) return '';
  const trimmedSignup = signupFullName && String(signupFullName).trim();
  const fromProfile = profile?.name && String(profile.name).trim();
  const fromEmail =
    profile?.email && String(profile.email).includes('@')
      ? String(profile.email).split('@')[0].trim()
      : '';
  const displayName = fromProfile || trimmedSignup || fromEmail || '';
  if (displayName) localStorage.setItem('userName', displayName);
  if (profile?.email) localStorage.setItem('userEmail', profile.email);
  localStorage.setItem('userId', user.id);
  return displayName;
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
  try {
    window._pendingUserAfter2FA = null;
  } catch (e) { /* noop */ }
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
      persistCustomerIdentityLocal(user, profile);
      showToast('Enter your 6-digit code', 'info');
      // Show 2FA step (demo: any 6 digits accepted; not wired to Supabase).
      window._pendingProfileAfter2FA = profile;
      window._pendingUserAfter2FA = user;
      if (typeof window.show2FAStep === 'function') {
        window.show2FAStep();
      } else {
        window._pendingUserAfter2FA = null;
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
  const pendingUser = window._pendingUserAfter2FA;
  const intent = window._authLoginIntent;
  window._pendingProfileAfter2FA = null;
  window._pendingUserAfter2FA = null;
  if (!profile) return;
  if (!checkLoginIntentMatch(intent, profile)) {
    await handleMismatchAndReset(intent === 'customer', profile);
    return;
  }
  const user =
    pendingUser ||
    (localStorage.getItem('userId') ? { id: localStorage.getItem('userId') } : null);
  if (user) persistCustomerIdentityLocal(user, profile);
  showToast('Welcome back!', 'success');
  redirectByRole(profile);
}
window.complete2FAAndRedirect = complete2FAAndRedirect;

let _signupInFlight = false;

/** Bind signup forms here so submit always runs after this module loads (avoids race with inline scripts). */
function bindStandaloneSignupForms() {
  ['customerSignupForm', 'adminSignupForm'].forEach((id) => {
    const form = document.getElementById(id);
    if (!form || form.dataset.meringuedAuthBound === '1') return;
    form.dataset.meringuedAuthBound = '1';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSignupClick();
    });
  });
}
bindStandaloneSignupForms();
if (typeof document !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindStandaloneSignupForms);
}

async function handleSignupClick() {
  if (_signupInFlight) return;
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

  _signupInFlight = true;
  try {
    showLoadingOverlay('Creating your account...');
    const { user, profile, session } = await signUpWithEmail({ email, password, fullName, role });

    let effectiveUser = user;
    let effectiveProfile = profile;

    // Email confirmation OFF → Supabase usually returns a session. If not, sign in immediately
    // so clientdashboard / admindashboard (ensureAuthenticated) still work.
    if (user && !session) {
      try {
        showLoadingOverlay('Signing you in...');
        const signedIn = await signInWithEmail({ email, password });
        effectiveUser = signedIn.user;
        effectiveProfile = signedIn.profile;
      } catch (signInErr) {
        hideLoadingOverlay();
        const sm = (signInErr?.message || '').toLowerCase();
        const needConfirm =
          sm.includes('confirm') || sm.includes('verified') || sm.includes('not confirmed');
        showToast(
          needConfirm
            ? 'Check your email to confirm your account, then sign in.'
            : 'Account may be created. Try signing in, or confirm your email if your project requires it.',
          'info'
        );
        window.location.href = window._authSignupRole === 'admin' ? 'admin-login.html' : 'customer-login.html';
        return;
      }
    }

    hideLoadingOverlay();

    if (effectiveUser) {
      const intent = window._authSignupRole;
      if (!checkLoginIntentMatch(intent, effectiveProfile)) {
        await handleMismatchAndReset(intent === 'customer', effectiveProfile);
        return;
      }
      persistCustomerIdentityLocal(effectiveUser, effectiveProfile, fullName);
      showToast('Account created!', 'success');
      redirectByRole(effectiveProfile);
    }
  } catch (err) {
    hideLoadingOverlay();
    const m = err?.message || 'Signup failed.';
    showToast(m.length > 380 ? m.slice(0, 377) + '…' : m, 'error');
    console.warn('[auth] signUp failed:', err);
  } finally {
    _signupInFlight = false;
  }
}

window.handleLogin = handleLoginClick;
window.handleSignup = handleSignupClick;

/**
 * For protected pages: ensure user is logged in (and optionally has required role).
 * - 'admin' → must be admin (else → index)
 * - 'customer' → customer area only: admins are sent to admin dashboard (avoids wrong name / order bucket)
 * - other string → profile.role must match
 * - omitted → any signed-in user
 */
export async function ensureAuthenticated(requiredRole) {
  const { user, profile } = await getSessionWithProfile();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  if (requiredRole === 'admin') {
    if (profile?.role !== 'admin') {
      window.location.href = 'index.html';
      return null;
    }
    return { user, profile };
  }
  if (requiredRole === 'customer') {
    if (profile?.role === 'admin') {
      window.location.replace('admindashboard.html');
      return null;
    }
    return { user, profile };
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
