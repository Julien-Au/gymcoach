import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodexLbProvider, extractCodexLbDelta, extractCodexLbText } from './codex-lb';
import { LlmError } from './types';

const ENV_KEYS = ['CODEX_LB_API_KEY', 'CODEX_LB_BASE_URL', 'CODEX_LB_MODEL'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
});

describe('CodexLbProvider', () => {
  it('reports not configured and throws 503 without a key', async () => {
    const provider = new CodexLbProvider();
    expect(provider.isConfigured()).toBe(false);
    await expect(
      provider.complete({ system: 'S', messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('uses configurable endpoint and parses Responses API output', async () => {
    process.env.CODEX_LB_API_KEY = 'test-key';
    process.env.CODEX_LB_BASE_URL = 'http://codex-lb.test/v1/';
    process.env.CODEX_LB_MODEL = 'gpt-test';
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            model: 'gpt-test',
            output: [{ content: [{ type: 'output_text', text: '  Hello coach  ' }] }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new CodexLbProvider();
    const result = await provider.complete({
      system: 'SYSTEM',
      messages: [{ role: 'user', content: 'payload' }],
      maxTokens: 1234,
      temperature: 0.4,
    });

    expect(result).toEqual({ text: 'Hello coach', modelUsed: 'gpt-test' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://codex-lb.test/v1/responses');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      model: 'gpt-test',
      instructions: 'SYSTEM',
      input: [{ role: 'user', content: 'payload' }],
      max_output_tokens: 1234,
      stream: false,
    });
  });

  it('maps an upstream HTTP error to LlmError', async () => {
    process.env.CODEX_LB_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('quota exhausted', { status: 429 })),
    );

    await expect(
      new CodexLbProvider().complete({
        system: 'S',
        messages: [{ role: 'user', content: 'x' }],
      }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('throws on an empty successful response', async () => {
    process.env.CODEX_LB_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ output: [] }), { status: 200 })),
    );

    await expect(
      new CodexLbProvider().complete({
        system: 'S',
        messages: [{ role: 'user', content: 'x' }],
      }),
    ).rejects.toBeInstanceOf(LlmError);
  });
});

describe('Responses API parsing', () => {
  it('extracts top-level and nested text', () => {
    expect(extractCodexLbText({ output_text: ' direct ' })).toBe('direct');
    expect(
      extractCodexLbText({
        output: [
          { content: [{ type: 'reasoning', text: 'hidden' }] },
          { content: [{ type: 'output_text', text: 'visible' }] },
        ],
      }),
    ).toBe('visible');
  });

  it('extracts streaming text deltas and ignores other events', () => {
    expect(extractCodexLbDelta('data: {"type":"response.output_text.delta","delta":"hello"}')).toBe(
      'hello',
    );
    expect(extractCodexLbDelta('data: {"type":"response.completed"}')).toBeNull();
    expect(extractCodexLbDelta('data: [DONE]')).toBeNull();
  });
});
