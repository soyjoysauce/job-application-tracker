import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../lib/httpError.js';

// Forwards unmatched routes to the central error middleware as a 404.
export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
}
