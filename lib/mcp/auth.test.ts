import { describe, expect, it } from 'vitest';
import { generateMcpToken, hashMcpToken, readMcpToken, visibleMcpTokenPrefix } from './auth';

describe('MCP token helpers', () => {
  it('generates opaque GymCoach-prefixed tokens', () => {
    const first = generateMcpToken();
    const second = generateMcpToken();
    expect(first).toMatch(/^gmc_[A-Za-z0-9_-]{40,}$/);
    expect(second).not.toBe(first);
    expect(visibleMcpTokenPrefix(first)).toMatch(/^gmc_.+\.\.\.$/);
  });

  it('hashes tokens deterministically without retaining the token', () => {
    const token = 'gmc_test-token';
    expect(hashMcpToken(token)).toHaveLength(64);
    expect(hashMcpToken(token)).toBe(hashMcpToken(token));
    expect(hashMcpToken(token)).not.toContain(token);
  });

  it('accepts bearer, custom header and query token authentication', () => {
    expect(
      readMcpToken(
        new Request('https://gymcoach.example/mcp', {
          headers: { Authorization: 'Bearer gmc_bearer' },
        }),
      ),
    ).toBe('gmc_bearer');
    expect(
      readMcpToken(
        new Request('https://gymcoach.example/mcp', {
          headers: { 'X-GymCoach-Token': 'gmc_header' },
        }),
      ),
    ).toBe('gmc_header');
    expect(readMcpToken(new Request('https://gymcoach.example/mcp?token=gmc_query'))).toBe(
      'gmc_query',
    );
  });
});
