// Core Supabase client setup (models import this). Login/signup use Supabase Auth.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://vycecixmpvsoicugggwh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5Y2VjaXhtcHZzb2ljdWdnZ3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NjgyMTYsImV4cCI6MjA4NTA0NDIxNn0.gSD7_WSeh6gRSOQxyM05upc_3UBLFsSVKuOTKoRDWII';

export const isSupabaseConfigured = true; 

export const BUSINESS_LOCATION = {
    lat: 7.079683,
    lng: 125.539021,
    address: "Davao City, Philippines",
    mapLink: "https://www.google.com/maps?q=7.079683,125.539021"
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return error ? null : user;
}