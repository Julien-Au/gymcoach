import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseFit, fitExerciseName, FIT_MAX_BYTES } from './fit';

// All valid fixtures below were produced by the official Garmin FIT SDK
// (@garmin/fitsdk) Encoder and verified with its Decoder (isFIT + checkIntegrity
// both true), so the hand-rolled parser is validated against real, spec-compliant
// bytes rather than our own encoding assumptions.
const FIXTURES = {
  // Running, 25 min, 5 km, HR 150 avg / 175 max, start 2026-03-15T09:00:00Z.
  running:
    'DgLYUlkAAAAuRklUmYtAAAAAAAUAAQIBAoQCAoQEBIYDBIwABP8AAAAQKRlE0gQAAEEAABIACP0EhgIEhgUBAgcEhggEhgkEhhABAhEBAgHsLhlEECkZRAFg4xYAYOMWACChBwCWr/Jq',
  // Cycling, 60 min, 20 km, no HR, start 2025-12-01T07:30:00Z.
  cycling:
    'DgLYUkoAAAAuRklU2JJAAAAAAAUAAQIBAoQCAoQEBIYDBIwABP8AAAD4949DCQAAAEEAABIABf0EhgIEhgUBAggEhgkEhgEIBpBD+PePQwKA7jYAgIQeAIKV',
  // Activity file with only a file_id, no session message.
  noSession: 'DgLYUiMAAAAuRklUHtBAAAAAAAUAAQIBAoQCAoQEBIYDBIwABP8AAAAg18RDBQAAAANE',
  // Session whose total_timer_time is 200000 s (> the 86400 s cap).
  overDuration:
    'DgLYUkoAAAAuRklU2JJAAAAAAAUAAQIBAoQCAoQEBIYDBIwABP8AAAAg18RDBQAAAEEAABIABf0EhgIEhgUBAggEhgkEhgFg5MdDINfEQwEAwusLIKEHAN4a',
  // Swimming sport -> maps to Other.
  swimming:
    'DgLYUlIAAAAuRklU2DhAAAAAAAUAAQIBAoQCAoQEBIYDBIwABP8AAAAg18RDBQAAAEEAABIAB/0EhgIEhgUBAggEhgkEhhABAhEBAgEo3sRDINfEQwVAdxsA8EkCAIygYfw=',
  // Running with SIX record samples (one/min): distance 0..1000 m, HR 140..165.
  withRecords:
    'DgLYUqwAAAAuRklUVvBAAAAAAAUAAQIBAoQCAoQEBIYDBIwABP8AAADgRTtEBwAAAEEAABQABP0EhgUEhgMBAgYChAHgRTtEAAAAAIzkDAEcRjtEIE4AAJHkDAFYRjtEQJwAAJbkDAGURjtEYOoAAJvkDAHQRjtEgDgBAKDkDAEMRztEoIYBAKXkDEIAABIAB/0EhgIEhgUBAggEhgkEhhABAhEBAgJIRztE4EU7RAFAfgUAoIYBAJalo+o=',
};

// A larger run (1100 one-second records) used to assert the downsample cap.
// Committed as a file so the test stays readable.
const FIT_1100_RECORDS = readFileSync('tests/fixtures/fit-1100-records.b64', 'utf8').trim();

function bytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

describe('parseFit (issue #249)', () => {
  it('decodes a real running session with heart rate', () => {
    const r = parseFit(bytes(FIXTURES.running));
    expect(r.ok).toBe(true);
    expect(r.activity).toEqual({
      startedAt: new Date('2026-03-15T09:00:00.000Z'),
      durationSec: 1500,
      distanceM: 5000,
      avgHr: 150,
      maxHr: 175,
      sport: 'Running',
      track: null, // this fixture carries no record stream
    });
  });

  it('extracts a downsampled pace/HR track from record messages (issue #254)', () => {
    const r = parseFit(bytes(FIXTURES.withRecords));
    expect(r.ok).toBe(true);
    expect(r.activity?.track).toEqual([
      { t: 0, d: 0, hr: 140 },
      { t: 60, d: 200, hr: 145 },
      { t: 120, d: 400, hr: 150 },
      { t: 180, d: 600, hr: 155 },
      { t: 240, d: 800, hr: 160 },
      { t: 300, d: 1000, hr: 165 },
    ]);
  });

  it('downsamples a long track to the point cap and keeps it ordered from t=0', () => {
    const r = parseFit(bytes(FIT_1100_RECORDS));
    expect(r.ok).toBe(true);
    const track = r.activity!.track!;
    expect(track.length).toBeGreaterThan(1); // it has a track
    expect(track.length).toBeLessThanOrEqual(500); // ...but is capped/downsampled
    expect(track.length).toBeLessThan(1100); // ...below the raw record count
    expect(track[0]!.t).toBe(0);
    // Monotonic non-decreasing time and cumulative distance.
    for (let i = 1; i < track.length; i++) {
      expect(track[i]!.t).toBeGreaterThan(track[i - 1]!.t);
      expect(track[i]!.d!).toBeGreaterThanOrEqual(track[i - 1]!.d!);
    }
  });

  it('decodes a real cycling session with no heart rate', () => {
    const r = parseFit(bytes(FIXTURES.cycling));
    expect(r.ok).toBe(true);
    expect(r.activity).toMatchObject({
      durationSec: 3600,
      distanceM: 20000,
      avgHr: null,
      maxHr: null,
      sport: 'Biking',
    });
    expect(r.activity?.startedAt.toISOString()).toBe('2025-12-01T07:30:00.000Z');
  });

  it('maps an unmapped sport (swimming) to Other', () => {
    const r = parseFit(bytes(FIXTURES.swimming));
    expect(r.activity?.sport).toBe('Other');
    expect(r.activity?.avgHr).toBe(140);
    expect(r.activity?.maxHr).toBe(160);
  });

  it('rejects a file that has no session message', () => {
    const r = parseFit(bytes(FIXTURES.noSession));
    expect(r.ok).toBe(false);
    expect(r.fatalError).toMatch(/no activity session/i);
  });

  it('rejects a session whose values are out of the supported range', () => {
    const r = parseFit(bytes(FIXTURES.overDuration));
    expect(r.ok).toBe(false);
    expect(r.fatalError).toMatch(/out of the supported range/i);
  });

  // ---- hostile / malformed input ----

  it('rejects a file that is too short to be a FIT', () => {
    expect(parseFit(new Uint8Array(8)).ok).toBe(false);
    expect(parseFit(bytes(FIXTURES.running).slice(0, 10)).fatalError).toMatch(/too short/i);
  });

  it('rejects a bad ".FIT" signature', () => {
    const b = bytes(FIXTURES.running);
    b[8] = 0x58; // 'X' instead of '.'
    const r = parseFit(b);
    expect(r.ok).toBe(false);
    expect(r.fatalError).toMatch(/signature/i);
  });

  it('rejects a corrupt header size', () => {
    const b = bytes(FIXTURES.running);
    b[0] = 0xff; // header size larger than the file
    expect(parseFit(b).fatalError).toMatch(/bad header/i);
  });

  it('rejects a data size that points past the buffer', () => {
    const b = bytes(FIXTURES.running);
    // Overwrite the uint32 data size (bytes 4..7) with a huge value.
    b[4] = 0xff;
    b[5] = 0xff;
    b[6] = 0xff;
    b[7] = 0x7f;
    expect(parseFit(b).fatalError).toMatch(/data size/i);
  });

  it('rejects a CRC mismatch (a flipped content byte)', () => {
    const b = bytes(FIXTURES.running);
    b[20] = (b[20]! ^ 0xff) & 0xff; // corrupt a record byte, leaving the trailing CRC
    const r = parseFit(b);
    expect(r.ok).toBe(false);
    expect(r.fatalError).toMatch(/CRC/i);
  });

  it('rejects random non-FIT bytes', () => {
    const b = new Uint8Array(64);
    for (let i = 0; i < b.length; i++) b[i] = (i * 37) & 0xff;
    expect(parseFit(b).ok).toBe(false);
  });

  it('rejects a blob larger than the size cap without scanning it', () => {
    const big = new Uint8Array(FIT_MAX_BYTES + 1);
    const r = parseFit(big);
    expect(r.ok).toBe(false);
    expect(r.fatalError).toMatch(/too large/i);
  });

  it('never throws on a sweep of truncations of a valid file', () => {
    const full = bytes(FIXTURES.running);
    for (let len = 0; len <= full.length; len++) {
      expect(() => parseFit(full.slice(0, len))).not.toThrow();
    }
  });
});

describe('fitExerciseName', () => {
  it('matches the GPX naming so the same sport reuses one exercise', () => {
    expect(fitExerciseName('Running')).toBe('Running');
    expect(fitExerciseName('Biking')).toBe('Cycling');
    expect(fitExerciseName('Other')).toBe('Cardio (imported)');
  });
});
