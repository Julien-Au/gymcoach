'use client';

import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Client-side mirror of the server cap (the server re-enforces it).
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// File.text() with a FileReader fallback (jsdom and older browsers).
async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

interface LineError {
  line: number;
  reason: string;
}

interface Preview {
  sessions: number;
  sets: number;
  newExercises: string[];
  existingSessionDates: string[];
  duplicatesSkipped: number;
  cardioSkipped: number;
  errorCount: number;
  errors: LineError[];
}

// Strong CSV import (issue #100): pick the export file, dry-run preview
// (counts + per-line errors, nothing written), then explicitly confirm.
export function ImportSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [unit, setUnit] = useState<'KG' | 'LB'>('KG');
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  function pickFile() {
    fileRef.current?.click();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('File too large: the limit is 5 MB.');
      return;
    }
    const text = await readFileText(file);
    setFileName(file.name);
    setCsvText(text);
    setPreview(null);
    await requestPreview(text);
  }

  async function callApi(csv: string, mode: 'preview' | 'confirm') {
    const res = await fetch('/api/import/strong', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv, unit, mode }),
    });
    const json = (await res.json().catch(() => null)) as
      | (Preview & {
          createdSessions?: number;
          createdSets?: number;
          createdExercises?: number;
          error?: string;
        })
      | null;
    if (!res.ok) {
      throw new Error(json?.error ?? `Error ${res.status}`);
    }
    return json;
  }

  async function requestPreview(csv: string) {
    setBusy(true);
    try {
      const json = await callApi(csv, 'preview');
      if (json) setPreview(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Preview failed.');
      setCsvText(null);
      setFileName(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!csvText) return;
    setBusy(true);
    try {
      const json = await callApi(csvText, 'confirm');
      toast.success(
        `Imported ${json?.createdSessions ?? 0} sessions, ${json?.createdSets ?? 0} sets` +
          ((json?.createdExercises ?? 0) > 0
            ? `, ${json?.createdExercises} new exercises.`
            : '.'),
      );
      setCsvText(null);
      setFileName(null);
      setPreview(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setCsvText(null);
    setFileName(null);
    setPreview(null);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold">Import from Strong</h2>
        <p className="text-xs text-muted-foreground">
          Bring your training history from the Strong app: export it as CSV
          (Settings, then Export data), preview it here, then confirm.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="strong-unit">Strong weight unit</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as 'KG' | 'LB')}>
              <SelectTrigger id="strong-unit" className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KG">kg</SelectItem>
                <SelectItem value="LB">lb</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={pickFile}
            disabled={busy}
            className="min-h-tap"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            <span className="ml-2">Choose a Strong CSV file</span>
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFilePicked}
        />

        {preview && (
          <div className="rounded-md border p-3 text-sm" data-testid="import-preview">
            <p className="font-medium">
              Preview of <code>{fileName}</code>
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                {preview.sessions} session{preview.sessions === 1 ? '' : 's'},{' '}
                {preview.sets} set{preview.sets === 1 ? '' : 's'} to import
              </li>
              {preview.newExercises.length > 0 && (
                <li>
                  {preview.newExercises.length} new exercise
                  {preview.newExercises.length === 1 ? '' : 's'} will be created:{' '}
                  {preview.newExercises.join(', ')}
                </li>
              )}
              {preview.duplicatesSkipped > 0 && (
                <li>{preview.duplicatesSkipped} exact duplicates will be skipped</li>
              )}
              {preview.cardioSkipped > 0 && (
                <li>{preview.cardioSkipped} cardio rows (no reps) will be skipped</li>
              )}
              {preview.existingSessionDates.length > 0 && (
                <li className="text-amber-700 dark:text-amber-400">
                  You already have sessions on:{' '}
                  {preview.existingSessionDates.join(', ')}
                </li>
              )}
            </ul>

            {preview.errorCount > 0 && (
              <div className="mt-2">
                <p className="font-medium text-rose-600">
                  {preview.errorCount} line{preview.errorCount === 1 ? '' : 's'}{' '}
                  could not be read and will be skipped:
                </p>
                <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-muted-foreground">
                  {preview.errors.map((e) => (
                    <li key={`${e.line}-${e.reason}`}>
                      Line {e.line}: {e.reason}
                    </li>
                  ))}
                  {preview.errorCount > preview.errors.length && (
                    <li>... and {preview.errorCount - preview.errors.length} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={confirmImport}
                disabled={busy || preview.sets === 0}
                className="min-h-tap"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                <span className={busy ? 'ml-2' : ''}>Confirm import</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
