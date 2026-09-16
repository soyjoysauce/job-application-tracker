// Auth middleware. STUB — implemented in roadmap step 2.
// Not mounted anywhere yet; only /api/health exists.
import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../lib/httpError.js';

export function requireAuth(_req: Request, _res: Response, next: NextFunction): void {
  // TODO(step 2):
  // 1. Read `Authorization: Bearer <token>`; missing/malformed → 401.
  // 2. Verify the token with Supabase Auth; invalid → 401.
  // 3. Attach the user and a per-request client (createUserClient(token)) to req.
  // 4. Call next().
  next(new HttpError(501, 'NOT_IMPLEMENTED', 'Auth middleware not implemented'));
}
