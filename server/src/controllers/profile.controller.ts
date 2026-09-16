import { updateProfileSchema } from '@jat/shared';
import type { Request, Response } from 'express';

import { getAuth } from '../middleware/auth.middleware.js';
import { parseBody } from '../lib/validate.js';
import * as profileService from '../services/profile.service.js';

// GET /api/profile
export async function getProfile(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  res.json(await profileService.getProfile(supabase, userId));
}

// PUT /api/profile — body: { skills: string[], stack: string[] }
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  const input = parseBody(updateProfileSchema, req);
  res.json(await profileService.saveProfile(supabase, userId, input));
}
