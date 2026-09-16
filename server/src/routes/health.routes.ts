import { Router } from 'express';

import { getHealth } from '../controllers/health.controller.js';

export const healthRouter = Router();

// GET /api/health — public, no auth.
healthRouter.get('/', getHealth);
