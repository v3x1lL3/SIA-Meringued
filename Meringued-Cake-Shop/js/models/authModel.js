// Auth model: login/signup via Supabase Auth.

import { supabase } from '../core/supabaseClient.js';

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

export async function signUpWithEmail({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim(), role: 'customer' } },
  });
  if (error) {
    const err = new Error(error.message);
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
    const err = new Error(error.message);
    err.name = 'AuthError';
    throw err;
  }
  const profile = profileFromUser(data.user);
  return { user: { id: data.user.id, email: data.user.email }, profile };
}

export async function getSessionWithProfile() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user) return { user: null, profile: null };
  const profile = profileFromUser(session.user);
  return { user: { id: session.user.id, email: session.user.email }, profile };
}

export async function listProfiles() {
  return [];
}

export function signOut() {
  return supabase.auth.signOut();
}
