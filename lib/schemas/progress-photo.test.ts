import { describe, it, expect } from 'vitest';
import { progressPhotoUploadQuerySchema } from './progress-photo';

describe('progressPhotoUploadQuerySchema', () => {
  it('accepts an empty query (both fields optional)', () => {
    const parsed = progressPhotoUploadQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.takenAt).toBeUndefined();
    expect(parsed.success && parsed.data.note).toBeUndefined();
  });

  it('accepts a valid ISO takenAt and trims the note', () => {
    const parsed = progressPhotoUploadQuerySchema.safeParse({
      takenAt: '2026-07-01T08:00:00.000Z',
      note: '  end of cut  ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.takenAt).toBe('2026-07-01T08:00:00.000Z');
      expect(parsed.data.note).toBe('end of cut');
    }
  });

  it('rejects an unparseable takenAt', () => {
    expect(
      progressPhotoUploadQuerySchema.safeParse({ takenAt: 'not-a-date' }).success,
    ).toBe(false);
  });

  it('rejects a takenAt outside the Postgres-safe year range', () => {
    // Parses in JS Date but would 500 deep in Prisma (year 275760).
    expect(
      progressPhotoUploadQuerySchema.safeParse({
        takenAt: '+275760-09-13T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('rejects a note longer than 500 characters', () => {
    expect(
      progressPhotoUploadQuerySchema.safeParse({ note: 'x'.repeat(501) }).success,
    ).toBe(false);
  });

  it('accepts a note of exactly 500 characters', () => {
    expect(
      progressPhotoUploadQuerySchema.safeParse({ note: 'x'.repeat(500) }).success,
    ).toBe(true);
  });
});
