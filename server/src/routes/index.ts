// Mounts all feature routers under /api (see app.ts).
import { Router } from 'express';

import { requireAuth } from '../middleware/auth.middleware.js';
import { healthRouter } from './health.routes.js';
import { meRouter } from './me.routes.js';

export const apiRouter = Router();

// Public
apiRouter.use('/health', healthRouter);

// Authenticated — every router below must have requireAuth in front of it.
apiRouter.use('/me', requireAuth, meRouter);
