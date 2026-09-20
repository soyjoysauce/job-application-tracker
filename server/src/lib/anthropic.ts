// Anthropic (Claude) client factory. The API key is server-only — the browser never calls Claude.
import Anthropic from '@anthropic-ai/sdk';

import { env } from '../config/env.js';

let client: Anthropic | undefined;

/** Created once per server instance so a warm Vercel instance reuses the connection. */
export function getAnthropicClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}
