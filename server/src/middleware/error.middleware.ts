// Central error handler. Every error response uses the shared ApiErrorBody shape:
// { error: { code, message, details? } }
import type { ApiErrorBody } from '@jat/shared';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { env } from '../config/env.js';
import { HttpError } from '../lib/httpError.js';

// Express recognises error middleware by its four parameters, so _next must stay.
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response<ApiErrorBody>,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        // Only field path + message; never echo the submitted values back.
        details: err.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // body-parser errors (e.g. payload too large, malformed JSON) carry a status.
  if (isClientErrorWithStatus(err)) {
    res.status(err.status).json({
      error: {
        code: err.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        message: err.message,
      },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'Something went wrong'
          : err instanceof Error
            ? err.message
            : String(err),
    },
  });
}

// True for Error objects with a 4xx `status` number. The `in` check lets TypeScript
// narrow `err` safely, without type casts.
function isClientErrorWithStatus(err: unknown): err is Error & { status: number } {
  if (!(err instanceof Error) || !('status' in err)) {
    return false;
  }
  const { status } = err;
  return typeof status === 'number' && status >= 400 && status < 500;
}
