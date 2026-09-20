import { Router } from 'express';

import { analyzePosting } from '../controllers/analysis.controller.js';
import {
  createPosting,
  deletePosting,
  getPosting,
  listPostings,
} from '../controllers/posting.controller.js';
import { rateLimit } from '../middleware/rateLimit.middleware.js';

// Mounted at /api/postings behind requireAuth. No update route: postings are read-only (ADR-009).
export const postingRouter = Router();

postingRouter.get('/', listPostings);
postingRouter.post('/', createPosting);
postingRouter.get('/:id', getPosting);
postingRouter.delete('/:id', deletePosting);

// The only route that calls Claude, so the only one behind the daily limit (ADR-006).
postingRouter.post('/:id/analyze', rateLimit, analyzePosting);
