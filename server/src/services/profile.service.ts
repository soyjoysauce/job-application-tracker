// Profile data access. `db` is the per-request client, so RLS limits every query to the user.
import type { Profile } from '@jat/shared';

import { toHttpError } from '../lib/dbError.js';
import type { Db } from '../lib/supabase.js';

const PROFILE_COLUMNS = 'skills, stack, updated_at';

interface ProfileRow {
  skills: string[];
  stack: string[];
  updated_at: string;
}

function toProfile(row: ProfileRow): Profile {
  return { skills: row.skills, stack: row.stack, updatedAt: row.updated_at };
}

/** Returns the user's profile, or an empty one if it hasn't been saved yet. */
export async function getProfile(db: Db, userId: string): Promise<Profile> {
  const { data, error } = await db
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw toHttpError(error);

  return data ? toProfile(data) : { skills: [], stack: [], updatedAt: null };
}

/** Creates or replaces the user's profile (one row per user). */
export async function saveProfile(
  db: Db,
  userId: string,
  input: { skills: string[]; stack: string[] },
): Promise<Profile> {
  const { data, error } = await db
    .from('profiles')
    .upsert(
      { user_id: userId, skills: input.skills, stack: input.stack },
      { onConflict: 'user_id' },
    )
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw toHttpError(error);

  return toProfile(data);
}
