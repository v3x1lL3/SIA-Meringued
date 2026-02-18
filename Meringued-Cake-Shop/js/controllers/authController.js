// Auth controller: wires login/signup to Supabase Auth.
// This file is loaded as a module from index.html and also provides
// simple guards for admin/client dashboards.

import { showToast, showLoadingOverlay, hideLoadingOverlay } from '../core/utils.js';
import { signUpWithEmail, signInWithEmail, getSessionWithProfile, signOut } from '../models/authModel.js';

function redirectByRole(profile) {
  const role = profile?.role || 'customer';
  window.location.href = role === 'admin' ? 'admindashboard.html' : 'clientdashboard.html';
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
      showToast('Welcome back!', 'success');
      redirectByRole(profile);
    }
  } catch (err) {
    hideLoadingOverlay();
    showToast(err.message || 'Login failed.', 'error');
  }
}

async function handleSignupClick() {
  const fullName = document.getElementById('signupName')?.value.trim();
  const email = document.getElementById('signupEmail')?.value.trim();
  const password = document.getElementById('signupPassword')?.value;
  const confirm = document.getElementById('signupConfirmPassword')?.value;

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
    const { user, profile } = await signUpWithEmail({ email, password, fullName });
    hideLoadingOverlay();

    if (user) {
      localStorage.setItem('userName', fullName);
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
  window.location.href = 'index.html';
}
