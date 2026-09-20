import { idParamSchema } from '@jat/shared';
import type { Request, Response } from 'express';

import { parseParams } from '../lib/validate.js';
import { getAuth } from '../middleware/auth.middleware.js';
import * as analysisService from '../services/analysis.service.js';

// POST /api/postings/:id/analyze — runs Claude and saves the result. Costs one daily quota unit.
export async function analyzePosting(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  res.json(await analysisService.analyzePosting(supabase, userId, id));
}
