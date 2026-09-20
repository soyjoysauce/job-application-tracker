// Anthropic (Claude) client factory. The API key is server-only — the browser never calls Claude.
//
// Named import, not the default: Vercel compiles this file with its own TypeScript settings,
// where a default import resolves to the module namespace ("TS2709: Cannot use namespace
// 'Anthropic' as a type"). The SDK exports the class by name too, which works either way.
import { Anthropic } from '@anthropic-ai/sdk';

import { env } from '../config/env.js';

let client: Anthropic | undefined;

/** Created once per server instance so a warm Vercel instance reuses the connection. */
export function getAnthropicClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}
