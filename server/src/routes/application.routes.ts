import { Router } from 'express';

import {
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  updateApplication,
} from '../controllers/application.controller.js';

// Mounted at /api/applications behind requireAuth.
export const applicationRouter = Router();

applicationRouter.get('/', listApplications);
applicationRouter.post('/', createApplication);
applicationRouter.get('/:id', getApplication);
applicationRouter.patch('/:id', updateApplication);
applicationRouter.delete('/:id', deleteApplication);
