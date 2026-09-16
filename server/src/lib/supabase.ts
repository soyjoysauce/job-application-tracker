// Supabase client factories.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '../config/env.js';
import type { Database } from '../types/database.types.js';

/** A Supabase client typed against our schema (regenerate types with `npm run db:types`). */
export type Db = SupabaseClient<Database>;

// Server-side clients never store sessions or refresh tokens: every request brings its own token.
const serverAuthOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

let authClient: SupabaseClient | undefined;

/**
 * Shared client used only to verify access tokens (`auth.getClaims(token)`).
 * Created once per server instance so the project's signing keys stay cached between requests.
 * Never use it for data queries — it has no user attached.
 */
export function getAuthClient(): SupabaseClient {
  authClient ??= createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: serverAuthOptions,
  });
  return authClient;
}

/**
 * Per-request client: anon/publishable key + the user's access token.
 * All queries run as that user, so RLS (auth.uid()) applies.
 * Create a new one for every request — never share between users.
 */
export function createUserClient(accessToken: string): Db {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: serverAuthOptions,
  });
}

/**
 * Admin client: service role key, BYPASSES RLS.
 * Use ONLY for admin operations (account deletion). Never expose to the client.
 */
export function createAdminClient(): Db {
  // TODO(step 4): createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: serverAuthOptions })
  throw new Error('Not implemented — see docs/roadmap.md step 4');
}
