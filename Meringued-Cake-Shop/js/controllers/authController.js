// Auth controller: wires the existing login/signup modal to Supabase auth.
// This file is loaded as a module from index.html and also provides
// simple guards for admin/client dashboards.

import { showToast, showLoadingOverlay, hideLoadingOverlay } from '../core/utils.js';
import { isSupabaseConfigured } from '../core/supabaseClient.js';
import {
  signUpWithEmail,
  signInWithEmail,
  signOut,
  getSessionWithProfile,
} from '../models/authModel.js';

import { getCurrentRoute } from '../core/router.js';

function redirectByRole(profile) {
  const role = profile?.role || 'customer';
  if (role === 'admin') {
    window.location.href = 'admindashboard.html';
  } else {
    window.location.href = 'clientdashboard.html';
  }
}

async function handleLoginClick() {
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');

  const email = emailInput?.value.trim() || '';
  const password = passwordInput?.value || '';

  if (!email || !password) {
    showToast('Please fill in email and password.', 'error');
    return;
  }

  // Local fallback when Supabase is not configured
  if (!isSupabaseConfigured) {
    const storedName = localStorage.getItem('userName');
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail && storedEmail.toLowerCase() === email.toLowerCase()) {
      const modal = document.getElementById('authModal');
      if (modal) modal.classList.remove('active');
      showToast('Welcome back! (Local mode)', 'success');
      redirectByRole({ role: 'customer', name: storedName || email });
    } else {
      showToast('No local account found. Sign up first, or configure Supabase for real auth.', 'error');
    }
    return;
  }

  try {
    showLoadingOverlay('Signing you in...');
    const { user, profile } = await signInWithEmail({ email, password });
    hideLoadingOverlay();

    if (!user) {
      showToast('Login failed. Please check your credentials.', 'error');
      return;
    }

    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('active');

    showToast('Welcome back!', 'success');
    redirectByRole(profile);
  } catch (err) {
    hideLoadingOverlay();
    console.error('[AuthController] login error:', err);
    showToast(err.message || 'Login failed. Please try again.', 'error');
  }
}

async function handleSignupClick() {
  const nameInput = document.getElementById('signupName');
  const emailInput = document.getElementById('signupEmail');
  const passwordInput = document.getElementById('signupPassword');
  const confirmInput = document.getElementById('signupConfirmPassword');

  const fullName = nameInput?.value.trim() || '';
  const email = emailInput?.value.trim() || '';
  const password = passwordInput?.value || '';
  const confirmPassword = confirmInput?.value || '';

  if (!fullName || !email || !password || !confirmPassword) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showToast('Passwords do not match.', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  // Local fallback when Supabase is not configured (avoids "failed to fetch")
  if (!isSupabaseConfigured) {
    try {
      showLoadingOverlay('Creating your account...');
      localStorage.setItem('userName', fullName);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('userRole', 'customer');
      hideLoadingOverlay();
      const modal = document.getElementById('authModal');
      if (modal) modal.classList.remove('active');
      showToast('Account created! (Local mode — no server)', 'success');
      redirectByRole({ role: 'customer', name: fullName });
    } catch (e) {
      hideLoadingOverlay();
      showToast('Sign up failed. Please try again.', 'error');
    }
    return;
  }

  try {
    showLoadingOverlay('Creating your account...');
    const { user, profile } = await signUpWithEmail({ email, password, fullName });
    hideLoadingOverlay();

    if (!user) {
      showToast(
        'Sign up succeeded, but we could not retrieve your user. Please verify your email and login.',
        'info'
      );
      return;
    }

    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('active');

    showToast('Account created! Please check your email to confirm.', 'success');

    // After signup, redirect based on role (likely customer).
    redirectByRole(profile);
  } catch (err) {
    hideLoadingOverlay();
    console.error('[AuthController] signup error:', err);
    showToast(err.message || 'Sign up failed. Please try again.', 'error');
  }
}

export async function ensureAuthenticated(requiredRole) {
  // Local/dev fallback: If Supabase is not configured yet, don't block page access.
  // This prevents admin/client pages from redirecting to index.html while you are still wiring Supabase.
  if (!isSupabaseConfigured) {
    console.warn('[AuthController] Supabase not configured; skipping auth guard.');
    const fallbackRole = requiredRole || localStorage.getItem('userRole') || 'customer';
    return {
      user: { id: 'local-dev' },
      profile: {
        id: 'local-dev',
        role: fallbackRole,
        name: localStorage.getItem('userName') || (fallbackRole === 'admin' ? 'Admin' : 'Guest'),
      },
    };
  }

  try {
    const { user, profile } = await getSessionWithProfile();
    if (!user) {
      showToast('Please login to continue.', 'info');
      window.location.href = 'index.html';
      return null;
    }

    if (requiredRole && profile?.role && profile.role !== requiredRole) {
      showToast('You do not have access to this area.', 'error');
      // Simple redirect: send everyone without correct role to client dashboard.
      window.location.href =
        profile.role === 'admin' ? 'admindashboard.html' : 'clientdashboard.html';
      return null;
    }

    return { user, profile };
  } catch (err) {
    console.error('[AuthController] ensureAuthenticated error:', err);
    showToast('Authentication check failed. Please login again.', 'error');
    window.location.href = 'index.html';
    return null;
  }
}

// Optional: used if you want to add a top-level logout button somewhere.
export async function handleLogoutRedirectToHome() {
  try {
    if (!isSupabaseConfigured) {
      window.location.href = 'index.html';
      return;
    }
    await signOut();
  } catch (err) {
    console.error('[AuthController] logout error:', err);
  } finally {
    window.location.href = 'index.html';
  }
}

// Expose handlers to the global window so existing onclick="handleLogin()"
// and onclick="handleSignup()" attributes continue to work without
// rewriting all HTML yet.
window.handleLogin = handleLoginClick;
window.handleSignup = handleSignupClick;

// If we are already on admindashboard/clientdashboard and a hash route exists,
// we can later react to it here (for now, just log).
console.debug('[AuthController] Loaded on route:', getCurrentRoute());

