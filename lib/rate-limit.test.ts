import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, resetRateLimits } from './rate-limit';

beforeEach(() => resetRateLimits());

describe('rateLimit', () => {
  it('allows up to the limit within the window, then blocks', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('k', 3, 1000, t0).ok).toBe(true);
    }
    const blocked = rateLimit('k', 3, 1000, t0 + 500);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const t0 = 2_000_000;
    expect(rateLimit('k2', 1, 1000, t0).ok).toBe(true);
    expect(rateLimit('k2', 1, 1000, t0 + 100).ok).toBe(false);
    expect(rateLimit('k2', 1, 1000, t0 + 1000).ok).toBe(true);
  });

  it('tracks each key independently', () => {
    const t0 = 3_000_000;
    expect(rateLimit('a', 1, 1000, t0).ok).toBe(true);
    expect(rateLimit('b', 1, 1000, t0).ok).toBe(true);
    expect(rateLimit('a', 1, 1000, t0).ok).toBe(false);
  });
});
