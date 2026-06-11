// ============================================================
// Shared CSV import plumbing (issues #100/#113) - pure, no DB
// ============================================================
// The low-level reader and the hard caps shared by every CSV import format
// (Strong, Hevy). The file content is UNTRUSTED user data: no eval, hard size
// and row caps, single-pass reading with no regex backtracking.

// Hard caps on the untrusted input, shared by all import formats.
export const IMPORT_CSV_MAX_BYTES = 5 * 1024 * 1024; // 5 MB of text
export const IMPORT_CSV_MAX_ROWS = 50000; // data rows, header excluded

// One malformed line, reported instead of failing the whole file.
export interface CsvLineError {
  // 1-based line number in the file (header is line 1).
  line: number;
  reason: string;
}

// ------------------------------------------------------------
// Minimal RFC4180-style CSV reader (quoted fields, "" escapes, quoted
// newlines, CRLF). Returns one string[] per record plus the 1-based line
// number the record starts on. No regex backtracking, single pass.
// ------------------------------------------------------------
export function readCsvRecords(text: string): Array<{ line: number; fields: string[] }> {
  const records: Array<{ line: number; fields: string[] }> = [];
  let fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let recordHasContent = false;

  const pushField = () => {
    fields.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    // Skip records that are entirely empty (blank lines).
    if (recordHasContent || fields.length > 1 || (fields[0] ?? '') !== '') {
      records.push({ line: recordStartLine, fields });
    }
    fields = [];
    recordHasContent = false;
    recordStartLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      recordHasContent = true;
    } else if (ch === ',') {
      pushField();
      recordHasContent = true;
    } else if (ch === '\n') {
      line++;
      pushRecord();
    } else if (ch === '\r') {
      // Swallow; the following \n (if any) ends the record.
      if (text[i + 1] !== '\n') {
        line++;
        pushRecord();
      }
    } else {
      field += ch;
      recordHasContent = true;
    }
  }
  // Final record without a trailing newline.
  if (recordHasContent || field !== '' || fields.length > 0) pushRecord();
  return records;
}

// Normalize a header cell for matching: lowercase, trimmed, collapsed spaces.
export function headerKey(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Lenient numeric cell reader: empty/absent reads as 0, garbage as NaN (so
// Zod rejects it downstream with a per-line error).
export function asNumber(cell: string | undefined): number {
  if (cell === undefined) return 0;
  const trimmed = cell.trim();
  if (trimmed === '') return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}
