import { Router } from 'express';

import { getUsage } from '../controllers/usage.controller.js';

// Mounted at /api/usage behind requireAuth. Reading usage is free (no rateLimit here).
export const usageRouter = Router();

usageRouter.get('/', getUsage);
