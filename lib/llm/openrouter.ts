import {
  LlmError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
} from './types';

// Any model exposed by OpenRouter, via its Chat Completions-compatible API.
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.5';
const DEFAULT_MAX_TOKENS = 8000;

interface OpenRouterResponse {
  model?: string;
  choices?: Array<{ message?: { role: string; content: string } }>;
  error?: { message: string; code?: number | string };
}

export class OpenRouterProvider implements LlmProvider {
  readonly id = 'openrouter' as const;
  readonly label = 'OpenRouter';
  readonly apiKeyEnvVar = 'OPENROUTER_API_KEY';
  readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly appName: string;
  private readonly appUrl: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
    this.appName = process.env.OPENROUTER_APP_NAME ?? 'GymCoach';
    this.appUrl = process.env.OPENROUTER_APP_URL ?? 'http://localhost:3030';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async complete(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
    if (!this.apiKey) {
      throw new LlmError(503, 'OPENROUTER_API_KEY is not configured.');
    }

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: req.system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    let res: Response;
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': this.appUrl,
          'X-Title': this.appName,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new LlmError(
        502,
        `Network failure to OpenRouter: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    if (!res.ok) {
      const text = await res.text();
      throw new LlmError(res.status, `OpenRouter ${res.status}: ${text.slice(0, 500)}`);
    }

    const json = (await res.json()) as OpenRouterResponse;
    if (json.error) {
      throw new LlmError(502, `OpenRouter: ${json.error.message}`);
    }
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new LlmError(502, 'Empty response from the coach.');
    }
    return { text, modelUsed: json.model ?? this.model };
  }
}
