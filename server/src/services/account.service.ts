// Account deletion — the only place the admin (service role) client is used (architecture rule 2).
import { isAuthApiError } from '@supabase/supabase-js';

import { notFound } from '../lib/dbError.js';
import { createAdminClient } from '../lib/supabase.js';

/**
 * Permanently deletes the user from Supabase Auth.
 * `on delete cascade` on every table's user_id then removes all of their rows
 * (profiles, job_postings, applications, usage_counters).
 *
 * `userId` must come from the verified token (getAuth), never from the request.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const admin = createAdminClient();

  // shouldSoftDelete must stay false: a soft delete keeps the auth.users row,
  // so the cascade would never run and the user's data would remain.
  const { error } = await admin.auth.admin.deleteUser(userId, false);

  if (isAuthApiError(error) && error.status === 404) {
    // Already deleted (e.g. the same still-valid token was used twice; see ADR-008).
    throw notFound('Account');
  }
  if (error) {
    throw new Error(`Account deletion failed: ${error.message}`);
  }
}
