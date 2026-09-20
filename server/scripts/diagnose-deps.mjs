// Temporary build diagnostic (roadmap step 11).
// Prints how `helmet` resolves in the build environment, because the same import
// compiles locally but fails on Vercel with "TS2349: This expression is not callable".
// Delete this file and the `buildCommand` entry in vercel.json once deploys are green.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

try {
  const entry = require.resolve('helmet');
  const dir = dirname(entry);
  const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;

  console.log('[diag] node:', process.version);
  console.log('[diag] helmet entry:', entry);
  console.log('[diag] helmet version:', version);
  console.log('[diag] helmet files:', readdirSync(dir).join(' '));
} catch (error) {
  console.log('[diag] could not inspect helmet:', error.message);
}
