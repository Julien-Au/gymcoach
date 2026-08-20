import { describe, expect, it } from 'vitest';
import { corsHeadersFor, mcpCorsPolicyFromEnv, parseAllowList } from './cors';

describe('parseAllowList', () => {
  it('returns undefined for unset, empty and comma-only values', () => {
    expect(parseAllowList(undefined)).toBeUndefined();
    expect(parseAllowList('')).toBeUndefined();
    expect(parseAllowList(' , ,')).toBeUndefined();
  });

  it('splits on commas and trims entries', () => {
    expect(parseAllowList(' https://a.test , https://b.test ')).toEqual([
      'https://a.test',
      'https://b.test',
    ]);
  });
});

describe('mcpCorsPolicyFromEnv', () => {
  it('reads both allowlists from the environment', () => {
    const policy = mcpCorsPolicyFromEnv({
      MCP_ALLOWED_ORIGINS: 'https://chat.example',
      MCP_ALLOWED_HOSTS: 'gym.example:3030',
    });
    expect(policy).toEqual({
      allowedOrigins: ['https://chat.example'],
      allowedHosts: ['gym.example:3030'],
    });
  });

  it('leaves both undefined when the env vars are unset', () => {
    expect(mcpCorsPolicyFromEnv({})).toEqual({
      allowedOrigins: undefined,
      allowedHosts: undefined,
    });
  });
});

describe('corsHeadersFor', () => {
  it('answers * when no origin allowlist is configured', () => {
    const headers = corsHeadersFor({}, 'https://anywhere.test');
    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers.Vary).toBeUndefined();
  });

  it('echoes an allowlisted origin and varies on Origin', () => {
    const headers = corsHeadersFor(
      { allowedOrigins: ['https://chat.example'] },
      'https://chat.example',
    );
    expect(headers['Access-Control-Allow-Origin']).toBe('https://chat.example');
    expect(headers.Vary).toBe('Origin');
  });

  it('omits Access-Control-Allow-Origin for a non-allowlisted or missing origin', () => {
    const policy = { allowedOrigins: ['https://chat.example'] };
    expect(corsHeadersFor(policy, 'https://evil.test')['Access-Control-Allow-Origin']).toBeUndefined();
    expect(corsHeadersFor(policy, null)['Access-Control-Allow-Origin']).toBeUndefined();
    expect(corsHeadersFor(policy, null)['Access-Control-Allow-Methods']).toContain('POST');
  });
});
