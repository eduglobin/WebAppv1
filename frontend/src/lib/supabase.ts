import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy frontend/.env.example → frontend/.env and fill in the values.'
  );
}

/**
 * Singleton Supabase client.
 *
 * Usage:
 *   import { supabase } from '@/lib/supabase';
 *
 *   // Auth
 *   const { data, error } = await supabase.auth.signInWithPassword({ email, password });
 *
 *   // Get current session JWT for API calls
 *   const { data: { session } } = await supabase.auth.getSession();
 *   const jwt = session?.access_token;
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage (default — fine for web)
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
