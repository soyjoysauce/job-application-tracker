// Daily Claude usage counting (ADR-006). Counters live in the database because
// Vercel runs several instances that don't share memory.
import type { UsageStatus } from '@jat/shared';

import { env } from '../config/env.js';
import { toHttpError } from '../lib/dbError.js';
import type { Db } from '../lib/supabase.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC today — the same instant the SQL function uses for window_start. */
function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Adds 1 to the user's counter for the current window and returns the new count.
 * Runs through the user's own client: the SQL function reads auth.uid() itself,
 * so one user can never spend another's quota.
 */
export async function incrementUsage(db: Db): Promise<number> {
  const { data, error } = await db.rpc('increment_usage');
  if (error) throw toHttpError(error);
  return data;
}

/** Current usage for the signed-in user, for display (no counting). */
export async function getUsage(db: Db, userId: string): Promise<UsageStatus> {
  const windowStart = startOfUtcDay();

  const { data, error } = await db
    .from('usage_counters')
    .select('request_count')
    .eq('user_id', userId)
    .eq('window_start', windowStart.toISOString())
    .maybeSingle();
  if (error) throw toHttpError(error);

  const limit = env.DAILY_CLAUDE_LIMIT;
  // Blocked requests still increment, so the stored number can pass the limit;
  // clamp it so the UI never shows "23 of 20".
  const used = Math.min(data?.request_count ?? 0, limit);

  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    resetAt: new Date(windowStart.getTime() + DAY_IN_MS).toISOString(),
  };
}

/** Exported for the rate-limit middleware's "try again after" message. */
export function nextWindowStart(): string {
  return new Date(startOfUtcDay().getTime() + DAY_IN_MS).toISOString();
}
