// Mounts all feature routers under /api (see app.ts).
import { Router } from 'express';

import { healthRouter } from './health.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);

// TODO(step 3+): mount authenticated routers here, e.g.
// apiRouter.use('/postings', requireAuth, postingsRouter);
