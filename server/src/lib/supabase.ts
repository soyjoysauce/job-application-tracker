// Supabase client factories. STUBS — implemented in roadmap steps 2 and 4.
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Per-request client: anon/publishable key + the user's access token.
 * All queries run as that user, so RLS (auth.uid()) applies.
 * Create a new one for every request — never share between users.
 */
export function createUserClient(_accessToken: string): SupabaseClient {
  // TODO(step 2): createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  //   global: { headers: { Authorization: `Bearer ${accessToken}` } },
  //   auth: { persistSession: false, autoRefreshToken: false },
  // })
  throw new Error('Not implemented — see docs/roadmap.md step 2');
}

/**
 * Admin client: service role key, BYPASSES RLS.
 * Use ONLY for admin operations (account deletion). Never expose to the client.
 */
export function createAdminClient(): SupabaseClient {
  // TODO(step 4): createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  throw new Error('Not implemented — see docs/roadmap.md step 4');
}
