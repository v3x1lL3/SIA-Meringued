// Auth model: login/signup via Supabase Auth.

import { supabase } from '../core/supabaseClient.js';

/** Turn Supabase Auth errors into a message the UI can show (adds hints for vague server errors). */
export function formatAuthError(error, context = 'auth') {
  if (!error) return context === 'signup' ? 'Sign up failed.' : 'Something went wrong.';
  const msg = (error.message || '').trim();
  const code = error.code ? ` (${error.code})` : '';
  const vague = /unexpected failure|server logs|internal error/i.test(msg);
  const hint =
    context === 'signup' && vague
      ? ' Open Supabase → Authentication → Providers → Email: turn OFF “Confirm email” while testing locally, OR configure custom SMTP. Then check Logs → Auth for the real error. Also run SUPABASE-SIGNUP-PROFILE-TRIGGER-ONLY.sql if the profiles trigger is missing.'
      : '';
  return (msg || 'Request failed.') + code + hint;
}

function profileFromUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    name: meta.full_name || user.email?.split('@')[0] || '',
    email: user.email,
    role: meta.role || 'customer',
  };
}

export async function signUpWithEmail({ email, password, fullName, role = 'customer' }) {
  const metaRole = role === 'admin' ? 'admin' : 'customer';
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim(), role: metaRole } },
  });
  if (error) {
    const errSnap = {
      message: error.message,
      code: error.code,
      status: error.status,
    };
    console.error('[auth] signUp Supabase error (copy this):', JSON.stringify(errSnap));
    console.error('[auth] signUp full error object:', error);
    const err = new Error(formatAuthError(error, 'signup'));
    err.name = 'AuthError';
    throw err;
  }
  if (!data?.user?.id) {
    const err = new Error(
      'Account was not created (no user returned). If email confirmation is on, check SMTP or disable confirmation for local testing.'
    );
    err.name = 'AuthError';
    throw err;
  }
  const profile = profileFromUser(data.user);
  return { user: { id: data.user.id, email: data.user.email }, session: data.session, profile };
}

export async function signInWithEmail({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    const err = new Error(formatAuthError(error, 'signin'));
    err.name = 'AuthError';
    throw err;
  }
  const profile = profileFromUser(data.user);
  return { user: { id: data.user.id, email: data.user.email }, profile };
}

function getDevBypassSession() {
  return { user: null, profile: null };
}

const DEV_BYPASS_KEY = 'meringued_dev_bypass';

export async function getSessionWithProfile() {
  if (typeof SUPABASE_AUTH_DISABLED !== 'undefined' && SUPABASE_AUTH_DISABLED) return getDevBypassSession();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user) return { user: null, profile: null };
  const profile = profileFromUser(session.user);
  return { user: { id: session.user.id, email: session.user.email }, profile };
}

export async function listProfiles() {
  return [];
}

export function signOut() {
  if (typeof SUPABASE_AUTH_DISABLED !== 'undefined' && SUPABASE_AUTH_DISABLED) {
    localStorage.removeItem(DEV_BYPASS_KEY);
    return Promise.resolve();
  }
  return supabase.auth.signOut();
}
