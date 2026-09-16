// Anthropic (Claude) client factory. STUB — implemented in roadmap step 8.
// The API key is server-only; the client never talks to Anthropic directly.
import type Anthropic from '@anthropic-ai/sdk';

export function getAnthropicClient(): Anthropic {
  // TODO(step 8): return a lazily created singleton: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  throw new Error('Not implemented — see docs/roadmap.md step 8');
}
