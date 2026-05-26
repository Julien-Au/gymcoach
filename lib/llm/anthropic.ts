import Anthropic from '@anthropic-ai/sdk';
import {
  LlmError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
} from './types';

// Default to the most capable model. Override with ANTHROPIC_MODEL (e.g.
// claude-sonnet-4-6 or claude-haiku-4-5) to trade intelligence for cost.
const DEFAULT_MODEL = 'claude-opus-4-7';
const DEFAULT_MAX_TOKENS = 8000;

export class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic' as const;
  readonly label = 'Anthropic';
  readonly apiKeyEnvVar = 'ANTHROPIC_API_KEY';
  readonly model: string;
  private readonly apiKey: string | undefined;
  private client: Anthropic | undefined;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async complete(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (!this.apiKey) {
      throw new LlmError(503, 'ANTHROPIC_API_KEY is not configured.');
    }
    this.client ??= new Anthropic({ apiKey: this.apiKey });

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        // Stable system prompt kept in its own block with a cache breakpoint.
        // Sampling params are intentionally omitted: Opus 4.7 rejects them and
        // the coach output is bounded by a strict format.
        system: [
          {
            type: 'text',
            text: req.system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      });

      const text = response.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('')
        .trim();
      if (!text) {
        throw new LlmError(502, 'Empty response from the coach.');
      }
      return { text, modelUsed: response.model ?? this.model };
    } catch (err) {
      if (err instanceof LlmError) throw err;
      if (err instanceof Anthropic.APIError) {
        throw new LlmError(err.status ?? 502, `Anthropic: ${err.message}`);
      }
      throw new LlmError(
        502,
        `Anthropic request failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }
}
