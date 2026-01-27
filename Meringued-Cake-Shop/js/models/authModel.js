// Auth model: wraps Supabase auth and profile access.

import { supabase } from '../core/supabaseClient.js';

const PROFILES_TABLE = 'profiles';

export async function signUpWithEmail({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) throw error;

  const user = data.user;
  if (!user) return { user: null, profile: null };

  // Create a default profile row for this user (role = customer by default).
  const { data: profile, error: profileError } = await supabase
    .from(PROFILES_TABLE)
    .insert({
      id: user.id,
      role: 'customer',
      name: fullName,
      email,
    })
    .select()
    .single();

  if (profileError) {
    // Do not block signup on profile insert, but log it.
    console.warn('[AuthModel] Failed to insert profile row:', profileError);
  }

  return { user, profile: profile ?? null };
}

export async function signInWithEmail({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  const user = data.user ?? null;
  const profile = user ? await getProfileByUserId(user.id) : null;

  return { user, profile };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSessionWithProfile() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session?.user) return { user: null, profile: null };

  const user = session.user;
  const profile = await getProfileByUserId(user.id);
  return { user, profile };
}

export async function getProfileByUserId(userId) {
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.warn('[AuthModel] getProfileByUserId error:', error.message);
    return null;
  }

  return data;
}

