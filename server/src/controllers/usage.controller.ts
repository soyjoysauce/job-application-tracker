import type { Request, Response } from 'express';

import { getAuth } from '../middleware/auth.middleware.js';
import * as usageService from '../services/usage.service.js';

// GET /api/usage — today's Claude usage for the signed-in user. Does not count against the limit.
export async function getUsage(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  res.json(await usageService.getUsage(supabase, userId));
}
