import { describe, it, expect } from 'vitest';
import { parseGpx, gpxExerciseName, haversineMeters, GPX_MAX_BYTES } from './gpx';

// ============================================================
// Helpers
// ============================================================

// A minimal GPX wrapper around inner <trk> markup.
const gpx = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>` +
  `<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">${inner}</gpx>`;

// A trackpoint at lat/lon with an optional ISO time and HR.
const pt = (lat: number, lon: number, time?: string, hr?: number) => {
  const ext = hr != null ? `<extensions><gpxtpx:hr>${hr}</gpxtpx:hr></extensions>` : '';
  const t = time ? `<time>${time}</time>` : '';
  return `<trkpt lat="${lat}" lon="${lon}">${t}${ext}</trkpt>`;
};

// A realistic short run: 4 points along a line, 60 seconds apart.
const RUN_GPX = gpx(
  `<trk><name>Morning run</name><type>running</type><trkseg>` +
    pt(48.8566, 2.3522, '2026-06-10T07:30:00.000Z', 150) +
    pt(48.857, 2.3525, '2026-06-10T07:31:00.000Z', 152) +
    pt(48.8575, 2.3528, '2026-06-10T07:32:00.000Z', 158) +
    pt(48.858, 2.3531, '2026-06-10T07:33:00.000Z', 160) +
    `</trkseg></trk>`,
);

// ============================================================
// Happy paths
// ============================================================

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters(48.85, 2.35, 48.85, 2.35)).toBe(0);
  });

  it('matches a known distance (Paris to London ~ 343 km)', () => {
    const d = haversineMeters(48.8566, 2.3522, 51.5074, -0.1278);
    expect(d / 1000).toBeGreaterThan(330);
    expect(d / 1000).toBeLessThan(350);
  });
});

describe('parseGpx (happy paths)', () => {
  it('derives duration from timestamps and distance from trackpoints', () => {
    const res = parseGpx(RUN_GPX);
    expect(res.ok).toBe(true);
    expect(res.activity!.startedAt).toEqual(new Date('2026-06-10T07:30:00.000Z'));
    // 07:30:00 -> 07:33:00 = 180 s.
    expect(res.activity!.durationSec).toBe(180);
    // Four points a few meters apart -> a small positive distance.
    expect(res.activity!.distanceM).toBeGreaterThan(0);
    expect(res.activity!.distanceM!).toBeLessThan(1000);
    // HR is the average of 150/152/158/160 = 155.
    expect(res.activity!.avgHr).toBe(155);
    expect(res.activity!.sport).toBe('Running');
  });

  it('maps <type> cycling to Biking and reads ns3:hr extension', () => {
    const res = parseGpx(
      gpx(
        `<trk><type>cycling</type><trkseg>` +
          `<trkpt lat="48.0" lon="2.0"><time>2026-06-10T07:30:00Z</time>` +
          `<extensions><ns3:hr>120</ns3:hr></extensions></trkpt>` +
          `<trkpt lat="48.01" lon="2.01"><time>2026-06-10T07:40:00Z</time>` +
          `<extensions><ns3:hr>130</ns3:hr></extensions></trkpt>` +
          `</trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(true);
    expect(res.activity!.sport).toBe('Biking');
    expect(res.activity!.avgHr).toBe(125);
  });

  it('defaults to Other sport when <type> is missing', () => {
    const res = parseGpx(
      gpx(
        `<trk><trkseg>` +
          pt(48.0, 2.0, '2026-06-10T07:30:00Z') +
          pt(48.01, 2.01, '2026-06-10T07:35:00Z') +
          `</trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(true);
    expect(res.activity!.sport).toBe('Other');
    expect(res.activity!.avgHr).toBeNull();
  });

  it('handles single-quoted lat/lon attributes', () => {
    const res = parseGpx(
      gpx(
        `<trk><trkseg>` +
          `<trkpt lat='48.0' lon='2.0'><time>2026-06-10T07:30:00Z</time></trkpt>` +
          `<trkpt lat='48.01' lon='2.0'><time>2026-06-10T07:31:00Z</time></trkpt>` +
          `</trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(true);
    expect(res.activity!.durationSec).toBe(60);
  });

  it('sums trackpoints across multiple segments and tracks', () => {
    const res = parseGpx(
      gpx(
        `<trk><type>running</type><trkseg>` +
          pt(48.0, 2.0, '2026-06-10T07:30:00Z') +
          pt(48.001, 2.0, '2026-06-10T07:31:00Z') +
          `</trkseg><trkseg>` +
          pt(48.002, 2.0, '2026-06-10T07:32:00Z') +
          `</trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(true);
    expect(res.activity!.durationSec).toBe(120);
    expect(res.activity!.distanceM).toBeGreaterThan(0);
  });

  it('drops a trackpoint with out-of-range coordinates', () => {
    const res = parseGpx(
      gpx(
        `<trk><trkseg>` +
          pt(48.0, 2.0, '2026-06-10T07:30:00Z') +
          `<trkpt lat="999" lon="2.0"><time>2026-06-10T07:31:00Z</time></trkpt>` +
          pt(48.01, 2.0, '2026-06-10T07:32:00Z') +
          `</trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(true);
    // 07:30 -> 07:32, the bad point in the middle contributed no time/distance.
    expect(res.activity!.durationSec).toBe(120);
  });

  it('degrades an out-of-bounds heart rate to null instead of failing', () => {
    const res = parseGpx(
      gpx(
        `<trk><trkseg>` +
          pt(48.0, 2.0, '2026-06-10T07:30:00Z', 999) +
          pt(48.01, 2.0, '2026-06-10T07:31:00Z', 999) +
          `</trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(true);
    expect(res.activity!.avgHr).toBeNull();
  });

  it('maps sport to the default exercise name', () => {
    expect(gpxExerciseName('Running')).toBe('Running');
    expect(gpxExerciseName('Biking')).toBe('Cycling');
    expect(gpxExerciseName('Other')).toBe('Cardio (imported)');
  });
});

// ============================================================
// Hostile fixtures (issue #204 SECURITY bar - same as #105/#108/#158)
// ============================================================

describe('parseGpx (hostile input)', () => {
  it('rejects a file with an internal DTD outright', () => {
    const res = parseGpx(
      `<?xml version="1.0"?><!DOCTYPE gpx [<!ELEMENT gpx ANY>]>` +
        gpx(`<trk><trkseg>${pt(48, 2, '2026-06-10T07:30:00Z')}</trkseg></trk>`),
    );
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/DTD and entity declarations are not allowed/);
  });

  it('rejects an external entity (XXE) attempt outright', () => {
    const res = parseGpx(
      `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>` +
        `<gpx><trk><trkseg><trkpt lat="48" lon="2"><name>&xxe;</name>` +
        `<time>2026-06-10T07:30:00Z</time></trkpt></trkseg></trk></gpx>`,
    );
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/not allowed/);
  });

  it('rejects a billion-laughs entity bomb outright (and fast)', () => {
    const bomb =
      `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">` +
      `<!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">` +
      `<!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">` +
      `<!ENTITY lol9 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">]>` +
      `<gpx>&lol9;</gpx>`;
    const start = Date.now();
    const res = parseGpx(bomb);
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/not allowed/);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('never expands entity references even without a DTD (no entity table)', () => {
    // An undeclared entity in a coordinate: it fails Number(), so the point is
    // dropped - nothing is ever resolved or substituted.
    const res = parseGpx(
      gpx(
        `<trk><trkseg><trkpt lat="&evil;" lon="2.0">` +
          `<time>2026-06-10T07:30:00Z</time></trkpt></trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/No usable trackpoints/);
  });

  it('ignores a <trk> smuggled inside an XML comment', () => {
    const res = parseGpx(
      gpx(
        `<!-- <trk><type>cycling</type><trkseg>` +
          pt(0, 0, '2000-01-01T00:00:00Z') +
          pt(80, 80, '2020-01-01T00:00:00Z') +
          `</trkseg></trk> -->` +
          `<trk><type>running</type><trkseg>` +
          pt(48.0, 2.0, '2026-06-10T07:30:00Z') +
          pt(48.01, 2.0, '2026-06-10T07:31:00Z') +
          `</trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(true);
    expect(res.activity!.sport).toBe('Running');
    expect(res.activity!.durationSec).toBe(60);
  });

  it('accepts a file whose DTD is commented out (inert by construction)', () => {
    const res = parseGpx(
      `<?xml version="1.0"?><!-- <!DOCTYPE gpx SYSTEM "http://evil.example/x.dtd"> -->` +
        gpx(
          `<trk><trkseg>` +
            pt(48.0, 2.0, '2026-06-10T07:30:00Z') +
            pt(48.01, 2.0, '2026-06-10T07:31:00Z') +
            `</trkseg></trk>`,
        ),
    );
    expect(res.ok).toBe(true);
    expect(res.activity!.durationSec).toBe(60);
  });

  it('drops everything after an unterminated comment', () => {
    const res = parseGpx(
      gpx(
        `<!-- never closed <trk><trkseg>${pt(48, 2, '2026-06-10T07:30:00Z')}</trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/No track found/);
  });

  it('rejects a null-byte-split <!DOCTYPE as a malformed markup declaration', () => {
    const res = parseGpx(
      `<?xml version="1.0"?><! DOCTYPE foo [<! ENTITY xxe SYSTEM "file:///etc/passwd">]>` +
        gpx(`<trk><trkseg>${pt(48, 2, '2026-06-10T07:30:00Z')}</trkseg></trk>`),
    );
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/malformed markup declaration/);
  });

  it('rejects CDATA sections (no real GPX export emits them in our fields)', () => {
    const res = parseGpx(
      gpx(
        `<trk><trkseg><trkpt lat="48" lon="2">` +
          `<time><![CDATA[2026-06-10T07:30:00Z]]></time></trkpt></trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/malformed markup declaration/);
  });

  it('keeps huge-coordinate-count work linear and refuses an over-cap file', () => {
    // Build a file just over the trackpoint cap (200000). It must not hang and
    // must be refused as too large, not imported as a partial total.
    // Minimal self-closing points (24 bytes each) so 200001 of them stay just
    // under the 5 MB byte cap and we exercise the TRACKPOINT cap, not the bytes.
    const big = gpx(`<trk><trkseg>${'<trkpt lat="1" lon="1"/>'.repeat(200_001)}</trkseg></trk>`);
    expect(big.length).toBeLessThan(GPX_MAX_BYTES);
    const start = Date.now();
    const res = parseGpx(big);
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/Too many trackpoints/);
    // Linear scan: comfortably under a second even at the cap.
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('treats a huge attribute value as absent (point dropped, not processed)', () => {
    const huge = '9'.repeat(100_000);
    const res = parseGpx(
      gpx(
        `<trk><trkseg><trkpt lat="${huge}" lon="2.0">` +
          `<time>2026-06-10T07:30:00Z</time></trkpt>` +
          pt(48.0, 2.0, '2026-06-10T07:30:00Z') +
          pt(48.01, 2.0, '2026-06-10T07:31:00Z') +
          `</trkseg></trk>`,
      ),
    );
    // The huge-lat point is dropped; the two real points still parse.
    expect(res.ok).toBe(true);
    expect(res.activity!.durationSec).toBe(60);
  });

  it('handles a truncated file gracefully', () => {
    const res = parseGpx(RUN_GPX.slice(0, Math.floor(RUN_GPX.length / 2)));
    expect(res.ok).toBe(false);
    expect(res.fatalError).toBeTruthy();
  });

  it('handles a truncated opening tag without hanging', () => {
    const res = parseGpx(`<gpx><trk><trkseg><trkpt lat="48`);
    expect(res.ok).toBe(false);
  });

  it('rejects a file over the shared byte cap', () => {
    const res = parseGpx('a'.repeat(GPX_MAX_BYTES + 1));
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/too large/i);
  });

  it('rejects non-GPX XML and empty input', () => {
    expect(parseGpx('<html><body>hi</body></html>').ok).toBe(false);
    expect(parseGpx('').ok).toBe(false);
    expect(parseGpx('not xml at all').ok).toBe(false);
  });

  it('rejects a route-only GPX (no <trk>)', () => {
    const res = parseGpx(
      gpx(`<rte><rtept lat="48" lon="2"></rtept></rte>`),
    );
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/No track found/);
  });

  it('rejects a track whose timestamps do not advance', () => {
    const res = parseGpx(
      gpx(
        `<trk><trkseg>` +
          pt(48.0, 2.0, '2026-06-10T07:30:00Z') +
          pt(48.01, 2.0, '2026-06-10T07:30:00Z') +
          `</trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/duration is zero/);
  });

  it('rejects a track with no timestamps (cannot derive duration)', () => {
    const res = parseGpx(
      gpx(`<trk><trkseg><trkpt lat="48" lon="2"></trkpt><trkpt lat="48.01" lon="2"></trkpt></trkseg></trk>`),
    );
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/no usable timestamps/i);
  });

  it('rejects a start time outside the sane window', () => {
    const res = parseGpx(
      gpx(
        `<trk><trkseg>` +
          pt(48.0, 2.0, '1980-01-01T00:00:00Z') +
          pt(48.01, 2.0, '1980-01-01T00:10:00Z') +
          `</trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/out of range/);
  });

  it('rejects a duration over 24 hours (out of bounds)', () => {
    const res = parseGpx(
      gpx(
        `<trk><trkseg>` +
          pt(48.0, 2.0, '2026-06-10T00:00:00Z') +
          pt(48.0001, 2.0, '2026-06-11T01:00:00Z') +
          `</trkseg></trk>`,
      ),
    );
    expect(res.ok).toBe(false);
    expect(res.fatalError).toMatch(/out of bounds/);
  });
});

describe('parseGpx track (issue #259)', () => {
  it('builds a downsampled pace/HR track from the trackpoints', () => {
    const r = parseGpx(RUN_GPX);
    expect(r.ok).toBe(true);
    const track = r.activity!.track!;
    expect(track).toHaveLength(4);
    expect(track.map((p) => p.t)).toEqual([0, 60, 120, 180]);
    expect(track.map((p) => p.hr)).toEqual([150, 152, 158, 160]);
    // Distance is the cumulative haversine sum and is non-decreasing from 0.
    expect(track[0]!.d).toBe(0);
    for (let i = 1; i < track.length; i++) {
      expect(track[i]!.d!).toBeGreaterThan(track[i - 1]!.d!);
    }
  });

  it('keeps a distance track but no HR when the points carry no heart rate', () => {
    const r = parseGpx(
      gpx(
        `<trk><type>running</type><trkseg>` +
          pt(48.85, 2.35, '2026-06-10T07:30:00Z') +
          pt(48.851, 2.351, '2026-06-10T07:31:00Z') +
          `</trkseg></trk>`,
      ),
    );
    expect(r.ok).toBe(true);
    expect(r.activity!.track!.every((p) => p.hr === undefined)).toBe(true);
    expect(r.activity!.track!.every((p) => typeof p.d === 'number')).toBe(true);
  });

  it('downsamples a long track to at most 500 points, ordered from t=0', () => {
    let inner = `<trk><type>running</type><trkseg>`;
    const base = new Date('2026-06-10T07:00:00.000Z').getTime();
    for (let i = 0; i < 600; i++) {
      inner += pt(48.85 + i * 0.0001, 2.35, new Date(base + i * 1000).toISOString(), 150);
    }
    inner += `</trkseg></trk>`;
    const r = parseGpx(gpx(inner));
    expect(r.ok).toBe(true);
    const track = r.activity!.track!;
    expect(track.length).toBeGreaterThan(1);
    expect(track.length).toBeLessThanOrEqual(500);
    expect(track.length).toBeLessThan(600);
    expect(track[0]!.t).toBe(0);
  });
});
