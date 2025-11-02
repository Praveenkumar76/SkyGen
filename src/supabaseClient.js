import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL:', supabaseUrl);
  console.error('Supabase Key:', supabaseAnonKey ? 'SET' : 'MISSING');
  throw new Error('Missing Supabase configuration. Please update frontend/src/config.js with your Supabase credentials or set environment variables.');
}

// Validate that the key is not a placeholder
if (supabaseAnonKey.includes('placeholder')) {
  throw new Error('Invalid Supabase key detected. Please update frontend/src/config.js with your actual Supabase anon key from your Supabase dashboard.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
