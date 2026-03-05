import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Use service role key on the backend to bypass RLS for server-side queries.
// Falls back to anon key if service role key is not set (not recommended for production).
export const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey || supabaseAnonKey,
  { auth: { persistSession: false } }
);

// Used in auth middleware to verify user tokens with Supabase Auth
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

export const getSupabaseClient = (accessToken) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
};
