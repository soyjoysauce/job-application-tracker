// Local development entry only. Not used on Vercel.
// Env vars are loaded by `--env-file=.env` in the npm scripts.
import app from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
