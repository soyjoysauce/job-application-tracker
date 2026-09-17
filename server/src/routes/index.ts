// Mounts all feature routers under /api (see app.ts).
import { Router } from 'express';

import { requireAuth } from '../middleware/auth.middleware.js';
import { accountRouter } from './account.routes.js';
import { applicationRouter } from './application.routes.js';
import { healthRouter } from './health.routes.js';
import { meRouter } from './me.routes.js';
import { postingRouter } from './posting.routes.js';
import { profileRouter } from './profile.routes.js';

export const apiRouter = Router();

// Public
apiRouter.use('/health', healthRouter);

// Authenticated — every router below must have requireAuth in front of it.
apiRouter.use('/me', requireAuth, meRouter);
apiRouter.use('/profile', requireAuth, profileRouter);
apiRouter.use('/postings', requireAuth, postingRouter);
apiRouter.use('/applications', requireAuth, applicationRouter);
apiRouter.use('/account', requireAuth, accountRouter);
