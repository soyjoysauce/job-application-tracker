import {
  createApplicationSchema,
  idParamSchema,
  listApplicationsQuerySchema,
  updateApplicationSchema,
} from '@jat/shared';
import type { Request, Response } from 'express';

import { getAuth } from '../middleware/auth.middleware.js';
import { parseBody, parseParams, parseQuery } from '../lib/validate.js';
import * as applicationService from '../services/application.service.js';

// GET /api/applications?status=applied
export async function listApplications(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  const { status } = parseQuery(listApplicationsQuerySchema, req);
  res.json(await applicationService.listApplications(supabase, userId, status));
}

// POST /api/applications — body: { postingId, status?, notes?, appliedAt? }
export async function createApplication(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  const { postingId, ...changes } = parseBody(createApplicationSchema, req);
  res
    .status(201)
    .json(await applicationService.createApplication(supabase, userId, postingId, changes));
}

// GET /api/applications/:id
export async function getApplication(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  res.json(await applicationService.getApplication(supabase, userId, id));
}

// PATCH /api/applications/:id — body: any of { status, notes, appliedAt }
export async function updateApplication(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  const changes = parseBody(updateApplicationSchema, req);
  res.json(await applicationService.updateApplication(supabase, userId, id, changes));
}

// DELETE /api/applications/:id
export async function deleteApplication(req: Request, res: Response): Promise<void> {
  const { userId, supabase } = getAuth(req);
  const { id } = parseParams(idParamSchema, req);
  await applicationService.deleteApplication(supabase, userId, id);
  res.status(204).end();
}
