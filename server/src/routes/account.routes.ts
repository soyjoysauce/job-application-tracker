import { Router } from 'express';

import { deleteAccount } from '../controllers/account.controller.js';

// Mounted at /api/account behind requireAuth.
export const accountRouter = Router();

accountRouter.delete('/', deleteAccount);
