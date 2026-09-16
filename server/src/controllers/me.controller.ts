import type { Request, Response } from 'express';

import { getAuth } from '../middleware/auth.middleware.js';

// GET /api/me — who the verified token belongs to. The client can use it to confirm a session works.
export function getMe(req: Request, res: Response): void {
  const { userId, email } = getAuth(req);
  res.status(200).json({ id: userId, email: email ?? null });
}
