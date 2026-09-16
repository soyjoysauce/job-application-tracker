import { Router } from 'express';

import {
  createPosting,
  deletePosting,
  getPosting,
  listPostings,
} from '../controllers/posting.controller.js';

// Mounted at /api/postings behind requireAuth. No update route: postings are read-only (ADR-009).
export const postingRouter = Router();

postingRouter.get('/', listPostings);
postingRouter.post('/', createPosting);
postingRouter.get('/:id', getPosting);
postingRouter.delete('/:id', deletePosting);
