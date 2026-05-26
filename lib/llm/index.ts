import { AnthropicProvider } from './anthropic';
import { OpenRouterProvider } from './openrouter';
import type { LlmProvider } from './types';

export * from './types';
export type LlmProviderId = LlmProvider['id'];

// Reads LLM_PROVIDER (case-insensitive). Defaults to 'anthropic'; an
// unrecognized value also falls back to 'anthropic'.
export function resolveProviderId(): LlmProviderId {
  return process.env.LLM_PROVIDER?.trim().toLowerCase() === 'openrouter'
    ? 'openrouter'
    : 'anthropic';
}

export function getLlmProvider(): LlmProvider {
  return resolveProviderId() === 'openrouter'
    ? new OpenRouterProvider()
    : new AnthropicProvider();
}
