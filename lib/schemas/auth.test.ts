import { describe, it, expect } from 'vitest';
import { registerSchema } from './auth';

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com',
      password: 'longenough',
      displayName: 'Al',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a password shorter than 8 chars', () => {
    expect(
      registerSchema.safeParse({ email: 'a@b.com', password: 'short' }).success,
    ).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(
      registerSchema.safeParse({ email: 'nope', password: 'longenough' }).success,
    ).toBe(false);
  });

  it('makes displayName optional', () => {
    expect(
      registerSchema.safeParse({ email: 'a@b.com', password: 'longenough' }).success,
    ).toBe(true);
  });
});
