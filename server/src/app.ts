// Express application module.
// Vercel detects this file (src/app.ts) and uses the default export as a single Vercel Function.
// Do NOT call app.listen() here — local development uses src/local.ts.
import cors from 'cors';
import express from 'express';
// `{ default as helmet }`, not a plain default import: helmet ships separate ESM and
// CommonJS type declarations, and Vercel's build resolves the CommonJS ones. A plain
// default import then yields the module object instead of the function
// ("TS2349: This expression is not callable"). Naming the export works under both.
import { default as helmet } from 'helmet';

import { env } from './config/env.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { notFoundMiddleware } from './middleware/notFound.middleware.js';
import { apiRouter } from './routes/index.js';

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
