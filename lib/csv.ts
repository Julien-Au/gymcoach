// CSV field escaping for the history export.
//
// Two concerns, both required:
// - RFC 4180: quote any field containing , " \n or \r, doubling inner quotes.
// - Formula injection: a field starting with = + - @ tab or CR executes as a
//   formula/DDE when the exported file is opened in Excel or LibreOffice.
//   Field values can be third-party-authored (a bulk import can plant
//   exercise names and notes), so leading formula characters are neutralized
//   with a single-quote prefix, the spreadsheet convention for "literal text".
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvEscape(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
