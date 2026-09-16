import { createPostingSchema, idParamSchema } from '@jat/shared';
import type { Request, Response } from 'express';

import { getAuth } from '../middleware/auth.middleware.js';
import { parseBody, parseParams } from '../lib/validate.js';
import * as postingService from '../services/posting.service.js';

// GET /api/postings
export async function listPostings(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  res.json(await postingService.listPostings(supabase, userId));
}

// POST /api/postings — body: { rawText }
export async function createPosting(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  const { rawText } = parseBody(createPostingSchema, req);
  res.status(201).json(await postingService.createPosting(supabase, userId, rawText));
}

// GET /api/postings/:id
export async function getPosting(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  res.json(await postingService.getPosting(supabase, userId, id));
}

// DELETE /api/postings/:id
export async function deletePosting(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  await postingService.deletePosting(supabase, userId, id);
  res.status(204).end();
}
