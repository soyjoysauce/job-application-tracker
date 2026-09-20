// Daily rate limit for Claude-backed endpoints (ADR-006).
// Counting happens BEFORE the work, so a failing or slow Claude call can't be retried for free.
// Mount after requireAuth: it needs req.auth.
import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { HttpError } from '../lib/httpError.js';
import { incrementUsage, nextWindowStart } from '../services/usage.service.js';
import { getAuth } from './auth.middleware.js';

export async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { supabase } = getAuth(req);

  const used = await incrementUsage(supabase);
  const limit = env.DAILY_CLAUDE_LIMIT;

  if (used > limit) {
    const resetAt = nextWindowStart();
    // Standard header telling the client how many seconds until it can retry.
    const secondsUntilReset = Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000);
    res.setHeader('Retry-After', String(secondsUntilReset));

    throw new HttpError(
      429,
      'RATE_LIMITED',
      `Daily limit of ${limit} requests reached. Try again after the reset.`,
      { limit, resetAt },
    );
  }

  next();
}
