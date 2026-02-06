// Core Supabase client setup for the whole app (models import this).
// Signup/Login use Supabase Auth. If URL/key are placeholders, you get "failed to fetch".
// - To use the app without Supabase: leave placeholders; signup/login use localStorage (local mode).
// - To use real auth: replace below with your project values from Supabase → Project Settings → API.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';

export const isSupabaseConfigured =
  !SUPABASE_URL.startsWith('https://YOUR-PROJECT-REF') &&
  SUPABASE_ANON_KEY !== 'YOUR_ANON_PUBLIC_KEY';

if (SUPABASE_URL.startsWith('https://YOUR-PROJECT-REF')) {
  console.warn(
    '[Supabase] SUPABASE_URL is still using the placeholder value. ' +
      'Update js/core/supabaseClient.js with your real project URL and anon key.'
  );
}

if (SUPABASE_ANON_KEY === 'YOUR_ANON_PUBLIC_KEY') {
  console.warn(
    '[Supabase] SUPABASE_ANON_KEY is still using the placeholder value. ' +
      'Update js/core/supabaseClient.js with your real anon key.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to get the current authenticated user (returns null if not logged in)
export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[Supabase] getCurrentUser error:', error);
    return null;
  }

  return user;
}

// Helper to get the current session (access token, etc.)
export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error('[Supabase] getCurrentSession error:', error);
    return null;
  }

  return session;
}

