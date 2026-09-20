// Express application module.
// Vercel detects this file (src/app.ts) and uses the default export as a single Vercel Function.
// Do NOT call app.listen() here — local development uses src/local.ts.
import cors from 'cors';
import express from 'express';
import type { RequestHandler } from 'express';
import * as helmetModule from 'helmet';

import { env } from './config/env.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { notFoundMiddleware } from './middleware/notFound.middleware.js';
import { apiRouter } from './routes/index.js';

/**
 * helmet ships both ESM and CommonJS type declarations, and different builds resolve
 * different ones: sometimes `helmet` is the function, sometimes it's the module object
 * with the function on `.default`. A plain default import fails on Vercel with
 * "TS2349: This expression is not callable" even though it compiles locally.
 * Taking whichever of the two is the function works everywhere.
 */
const helmet = ((helmetModule as { default?: unknown }).default ??
  helmetModule) as () => RequestHandler;

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

app.use('/api', apiRouter);

// Order matters: 404 handler after all routes, error handler last.
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
