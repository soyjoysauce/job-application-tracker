// Browser Supabase client (used for Auth only; data goes through the Express API).
// STUB — implemented in roadmap step 5.
import type { SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseClient(): SupabaseClient {
  // TODO(step 5): create a singleton with createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
  throw new Error('Not implemented — see docs/roadmap.md step 5');
}
