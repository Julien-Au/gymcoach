import { describe, it, expect } from 'vitest';
import { csvEscape } from './csv';

describe('csvEscape', () => {
  it('passes plain values through unchanged', () => {
    expect(csvEscape('Bench press')).toBe('Bench press');
    expect(csvEscape('100')).toBe('100');
    expect(csvEscape('')).toBe('');
  });

  it('quotes fields containing separators and doubles inner quotes', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"');
  });

  it('neutralizes every leading formula character', () => {
    expect(csvEscape('=cmd|calc')).toBe("'=cmd|calc");
    expect(csvEscape('+1+1')).toBe("'+1+1");
    expect(csvEscape('-2+3')).toBe("'-2+3");
    expect(csvEscape('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvEscape('\timport')).toBe("'\timport");
    expect(csvEscape('\rimport')).toBe('"\'\rimport"');
  });

  it('quotes a neutralized field that also contains separators', () => {
    expect(csvEscape('=HYPERLINK("http://x"),click')).toBe(
      '"\'=HYPERLINK(""http://x""),click"',
    );
  });

  it('does not touch formula characters inside the value', () => {
    expect(csvEscape('weighted dips +20kg')).toBe('weighted dips +20kg');
    expect(csvEscape('a=b')).toBe('a=b');
  });
});
