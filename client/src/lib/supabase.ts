// Browser Supabase client. Used for Auth only — all data goes through the Express API,
// which verifies the token and applies RLS (see docs/architecture.md).
import { createClient } from '@supabase/supabase-js';

import { env } from './env';

// Created once: two clients would compete over the same stored session.
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    // Keep the session in localStorage so a page refresh stays signed in.
    persistSession: true,
    // Renew the access token before it expires (default lifetime: 1 hour).
    autoRefreshToken: true,
    // We never use magic links / OAuth redirects, so don't read tokens from the URL.
    detectSessionInUrl: false,
  },
});
