import { describe, it, expect } from 'vitest';
import {
  readCsvRecords,
  headerKey,
  asNumber,
  IMPORT_CSV_MAX_BYTES,
  IMPORT_CSV_MAX_ROWS,
} from './csv';

// Direct, adversarial coverage for the shared quote-aware CSV reader and the
// numeric/header helpers (issue #198). These parse UNTRUSTED uploaded files, so
// the tests assert the real implemented contract (verified against the source),
// not assumed RFC4180 behavior.

describe('readCsvRecords', () => {
  it('reads plain comma-separated rows with 1-based line numbers', () => {
    expect(readCsvRecords('a,b,c\nd,e,f')).toEqual([
      { line: 1, fields: ['a', 'b', 'c'] },
      { line: 2, fields: ['d', 'e', 'f'] },
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(readCsvRecords('"a,1",b')).toEqual([
      { line: 1, fields: ['a,1', 'b'] },
    ]);
  });

  it('keeps newlines inside quoted fields (a record spanning lines)', () => {
    // The multi-line record reports its OWN start line; the line counter still
    // advances across the embedded newline so the next record is numbered right.
    expect(readCsvRecords('a,b\n"x\ny",z\nlast,1')).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 2, fields: ['x\ny', 'z'] },
      { line: 4, fields: ['last', '1'] },
    ]);
  });

  it('unescapes doubled double-quotes inside a quoted field', () => {
    expect(readCsvRecords('"he said ""hi""",2')).toEqual([
      { line: 1, fields: ['he said "hi"', '2'] },
    ]);
  });

  it('preserves a trailing empty field', () => {
    expect(readCsvRecords('a,b,')).toEqual([
      { line: 1, fields: ['a', 'b', ''] },
    ]);
  });

  it('preserves empty fields between separators', () => {
    expect(readCsvRecords('a,,c')).toEqual([
      { line: 1, fields: ['a', '', 'c'] },
    ]);
  });

  it('treats CRLF and LF line endings identically', () => {
    const crlf = readCsvRecords('a,b\r\nc,d\r\n');
    const lf = readCsvRecords('a,b\nc,d\n');
    expect(crlf).toEqual(lf);
    expect(crlf).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 2, fields: ['c', 'd'] },
    ]);
  });

  it('treats a lone CR as a record separator', () => {
    expect(readCsvRecords('a,b\rc,d')).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 2, fields: ['c', 'd'] },
    ]);
  });

  it('skips a blank trailing line', () => {
    expect(readCsvRecords('a,b\n\n')).toEqual([
      { line: 1, fields: ['a', 'b'] },
    ]);
  });

  it('skips blank lines in the middle but keeps line numbering accurate', () => {
    expect(readCsvRecords('a,b\n\nc,d')).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 3, fields: ['c', 'd'] },
    ]);
  });

  it('reads a final record that has no trailing newline', () => {
    expect(readCsvRecords('a,b\nc,d')).toEqual([
      { line: 1, fields: ['a', 'b'] },
      { line: 2, fields: ['c', 'd'] },
    ]);
  });

  it('returns no records for an empty string', () => {
    expect(readCsvRecords('')).toEqual([]);
  });

  it('returns no records for input that is only blank lines', () => {
    expect(readCsvRecords('\n\n\n')).toEqual([]);
  });

  it('keeps a single-field row that has content', () => {
    expect(readCsvRecords('solo')).toEqual([{ line: 1, fields: ['solo'] }]);
  });

  it('does not treat a comma-only line as blank (it has two empty fields)', () => {
    // recordHasContent is set by the comma, so this row is kept rather than
    // dropped as an empty line.
    expect(readCsvRecords(',')).toEqual([{ line: 1, fields: ['', ''] }]);
  });
});

describe('headerKey', () => {
  it('lowercases, trims, and collapses internal whitespace', () => {
    expect(headerKey('  Set  Order  ')).toBe('set order');
  });

  it('collapses tabs and newlines as whitespace', () => {
    expect(headerKey('Weight\t(kg)')).toBe('weight (kg)');
  });

  it('leaves an already-normalized key unchanged', () => {
    expect(headerKey('reps')).toBe('reps');
  });

  it('maps a whitespace-only cell to an empty string', () => {
    expect(headerKey('   ')).toBe('');
  });
});

describe('asNumber', () => {
  it('parses integers and decimals', () => {
    expect(asNumber('42')).toBe(42);
    expect(asNumber('3.5')).toBe(3.5);
    expect(asNumber('-7.25')).toBe(-7.25);
  });

  it('ignores surrounding whitespace', () => {
    expect(asNumber('  5  ')).toBe(5);
  });

  it('reads an empty cell as 0', () => {
    expect(asNumber('')).toBe(0);
    expect(asNumber('   ')).toBe(0);
  });

  it('reads an absent (undefined) cell as 0', () => {
    expect(asNumber(undefined)).toBe(0);
  });

  it('returns NaN for non-numeric garbage', () => {
    expect(asNumber('abc')).toBeNaN();
    expect(asNumber('1,5')).toBeNaN();
  });

  it('accepts exponent notation as a finite number', () => {
    // Number("1e3") is finite, so the value passes through.
    expect(asNumber('1e3')).toBe(1000);
  });

  it('returns NaN for Infinity / -Infinity / NaN inputs (never a non-finite number)', () => {
    // Number.isFinite guards the result, so these can never leak a non-finite
    // value into downstream numeric handling.
    expect(asNumber('Infinity')).toBeNaN();
    expect(asNumber('-Infinity')).toBeNaN();
    expect(asNumber('NaN')).toBeNaN();
  });

  it('never returns a non-finite number for any input it does not read as 0', () => {
    for (const cell of ['Infinity', '-Infinity', 'NaN', '1e999']) {
      const n = asNumber(cell);
      // Either NaN (rejected) - never +/-Infinity.
      expect(n === Infinity || n === -Infinity).toBe(false);
    }
  });
});

describe('import caps', () => {
  it('exposes the shared byte and row caps as the documented values', () => {
    expect(IMPORT_CSV_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(IMPORT_CSV_MAX_ROWS).toBe(50000);
  });

  it('readCsvRecords itself does not enforce the row cap (callers do)', () => {
    // The reader is a pure single-pass tokenizer; the format parsers enforce
    // IMPORT_CSV_MAX_ROWS / IMPORT_CSV_MAX_BYTES against its output, so a file
    // over the row cap is fully read here and rejected upstream.
    const rows = new Array(IMPORT_CSV_MAX_ROWS + 5).fill('x,y').join('\n');
    const records = readCsvRecords(rows);
    expect(records.length).toBe(IMPORT_CSV_MAX_ROWS + 5);
  });
});
