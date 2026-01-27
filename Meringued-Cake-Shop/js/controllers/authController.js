// Auth controller: wires the existing login/signup modal to Supabase auth.
// This file is loaded as a module from index.html and also provides
// simple guards for admin/client dashboards.

import { showToast, showLoadingOverlay, hideLoadingOverlay } from '../core/utils.js';
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

