/**
 * Supabase browser client — singleton for use in React hooks and components.
 *
 * Environment variables (set in .env.local):
 *   VITE_SUPABASE_URL      – Your Supabase project URL
 *   VITE_SUPABASE_ANON_KEY – Your Supabase anon/public key
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. ' +
      'Subscription checks will always return false.',
  );
}

export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'anon-key-placeholder',
);
