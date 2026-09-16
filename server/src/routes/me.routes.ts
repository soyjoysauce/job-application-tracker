import { Router } from 'express';

import { getMe } from '../controllers/me.controller.js';

export const meRouter = Router();

// GET /api/me — requires auth (applied where this router is mounted).
meRouter.get('/', getMe);
