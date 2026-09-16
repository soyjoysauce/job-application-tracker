import { Router } from 'express';

import { getProfile, updateProfile } from '../controllers/profile.controller.js';

// Mounted at /api/profile behind requireAuth.
export const profileRouter = Router();

profileRouter.get('/', getProfile);
profileRouter.put('/', updateProfile);
