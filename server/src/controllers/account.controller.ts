import type { Request, Response } from 'express';

import { getAuth } from '../middleware/auth.middleware.js';
import * as accountService from '../services/account.service.js';

// DELETE /api/account — deletes the signed-in user and all of their data. No body.
// The "are you sure?" confirmation happens in the UI.
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  const { userId } = getAuth(req);
  await accountService.deleteAccount(userId);
  res.status(204).end();
}
