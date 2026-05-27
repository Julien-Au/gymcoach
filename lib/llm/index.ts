import { AnthropicProvider } from './anthropic';
import { OpenRouterProvider } from './openrouter';
import { DemoProvider } from './demo';
import type { LlmProvider } from './types';

export * from './types';
export type LlmProviderId = LlmProvider['id'];

// Reads LLM_PROVIDER (case-insensitive). Defaults to 'anthropic'; an
// unrecognized value also falls back to 'anthropic'. 'demo' serves canned
// responses (no key needed), useful to try the AI screens.
export function resolveProviderId(): LlmProviderId {
  const raw = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (raw === 'openrouter') return 'openrouter';
  if (raw === 'demo') return 'demo';
  return 'anthropic';
}

export function getLlmProvider(): LlmProvider {
  const id = resolveProviderId();
  if (id === 'openrouter') return new OpenRouterProvider();
  if (id === 'demo') return new DemoProvider();
  return new AnthropicProvider();
}
