'use client';

import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { formatCardioSet } from '@/lib/cardio';
import { FIT_MAX_BATCH } from '@/lib/schemas/import';
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

// Read a binary file (FIT, issue #249) as base64 so it can ride the JSON import
// payload. Uses arrayBuffer() with a FileReader fallback for jsdom.
async function readFileBase64(file: File): Promise<string> {
  const buf =
    typeof file.arrayBuffer === 'function'
      ? await file.arrayBuffer()
      : await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(file);
        });
  const b = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < b.length; i++) binary += String.fromCharCode(b[i]!);
  return btoa(binary);
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
  // Cardio sets to import (issue #134) vs rows that still cannot be
  // represented (no usable duration) and are skipped with a notice.
  cardioSets: number;
  cardioSkipped: number;
  errorCount: number;
  errors: LineError[];
}

// TCX preview/confirm payload (issue #152): one activity = one session, so
// the shape is a single summary instead of the CSV counts.
interface TcxPreview {
  sport: string;
  exerciseName: string;
  startedAt: string;
  durationSec: number;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  duplicateSessions: string[];
}

// FIT batch preview (issue #253): one entry per uploaded file. A file that
// failed to parse comes back ok:false with an error instead of a summary.
interface FitBatchActivity extends Partial<TcxPreview> {
  index: number;
  ok: boolean;
  error?: string;
}
interface FitBatchPreview {
  activities: FitBatchActivity[];
  importable: number;
  skipped: number;
}

type ImportFormat = 'STRONG' | 'HEVY' | 'GYMCOACH' | 'TCX' | 'GPX' | 'FIT';

// Copy and endpoint per supported source app. Strong keeps its unit toggle
// (its export follows the app's unit setting); Hevy always exports kg, so the
// toggle is hidden for it. TCX (issue #152) and GPX (issue #204) are both
// single-activity cardio files - they share the preview/confirm UI.
// `source` names where the history comes from in the intro sentence.
const FORMAT_META: Record<
  ImportFormat,
  {
    label: string;
    source: string;
    endpoint: string;
    exportHint: string;
    hasUnitToggle: boolean;
    accept: string;
    fileKind: string;
  }
> = {
  STRONG: {
    label: 'Strong',
    source: 'the Strong app',
    endpoint: '/api/import/strong',
    exportHint: 'export it as CSV (Settings, then Export data)',
    hasUnitToggle: true,
    accept: '.csv,text/csv',
    fileKind: 'CSV',
  },
  HEVY: {
    label: 'Hevy',
    source: 'the Hevy app',
    endpoint: '/api/import/hevy',
    exportHint: 'export it as CSV (Settings, then Export & Import Data)',
    hasUnitToggle: false,
    accept: '.csv,text/csv',
    fileKind: 'CSV',
  },
  GYMCOACH: {
    label: 'GymCoach',
    source: 'a GymCoach history CSV',
    endpoint: '/api/import/gymcoach',
    exportHint:
      'use the CSV from the History page export, or any spreadsheet with the same columns (session_date, workout, exercise, set_number, external_load_kg, reps, ...)',
    hasUnitToggle: false,
    accept: '.csv,text/csv',
    fileKind: 'CSV',
  },
  TCX: {
    label: 'TCX file',
    source: 'a TCX file',
    endpoint: '/api/import/tcx',
    exportHint:
      'export the activity as TCX from your watch platform (Garmin Connect, Polar Flow, ...) and it becomes one cardio session with duration, distance and heart rate',
    hasUnitToggle: false,
    accept: '.tcx,application/vnd.garmin.tcx+xml,application/xml,text/xml',
    fileKind: 'TCX',
  },
  GPX: {
    label: 'GPX file',
    source: 'a GPX file',
    endpoint: '/api/import/gpx',
    exportHint:
      'export the route as GPX from Strava, Komoot or Apple Fitness and it becomes one cardio session with duration, distance and heart rate',
    hasUnitToggle: false,
    accept: '.gpx,application/gpx+xml,application/xml,text/xml',
    fileKind: 'GPX',
  },
  FIT: {
    label: 'FIT file',
    source: 'a FIT file',
    endpoint: '/api/import/fit',
    exportHint:
      'export the activity as a FIT file from your Garmin (or other) watch and it becomes one cardio session with duration, distance and heart rate',
    hasUnitToggle: false,
    accept: '.fit,application/vnd.ant.fit,application/octet-stream',
    fileKind: 'FIT',
  },
};

// CSV import from another tracker (issues #100/#113): pick the source app and
// the export file, dry-run preview (counts + per-line errors, nothing
// written), then explicitly confirm.
export function ImportSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<ImportFormat>('STRONG');
  const [unit, setUnit] = useState<'KG' | 'LB'>('KG');
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [tcxPreview, setTcxPreview] = useState<TcxPreview | null>(null);
  // FIT supports a multi-file batch (issue #253): the base64 payloads and the
  // aggregated per-file preview live here, separate from the single-file states.
  const [fitPayloads, setFitPayloads] = useState<string[] | null>(null);
  const [fitBatch, setFitBatch] = useState<FitBatchPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const meta = FORMAT_META[format];
  const isTcx = format === 'TCX';
  const isGpx = format === 'GPX';
  const isFit = format === 'FIT';
  // TCX, GPX and FIT are all single-activity cardio imports: same summary
  // shape, same preview/confirm UI. FIT is the only binary one (read as base64).
  const isCardioActivity = isTcx || isGpx || isFit;

  function pickFile() {
    fileRef.current?.click();
  }

  function resetPreviews() {
    setCsvText(null);
    setFileName(null);
    setPreview(null);
    setTcxPreview(null);
    setFitPayloads(null);
    setFitBatch(null);
  }

  function switchFormat(next: ImportFormat) {
    if (busy) return;
    setFormat(next);
    // A pending preview was produced by the other parser; drop it.
    resetPreviews();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (files.some((f) => f.size > MAX_FILE_BYTES)) {
      toast.error('A file is too large: the limit is 5 MB each.');
      return;
    }

    // FIT (issue #253) is binary AND supports a multi-file batch.
    if (isFit) {
      if (files.length > FIT_MAX_BATCH) {
        toast.error(`Up to ${FIT_MAX_BATCH} FIT files at once.`);
        return;
      }
      const payloads = await Promise.all(files.map(readFileBase64));
      setFileName(files.map((f) => f.name).join(', '));
      setFitPayloads(payloads);
      setPreview(null);
      setTcxPreview(null);
      await requestFitPreview(payloads);
      return;
    }

    // Every other format is single-file text.
    const file = files[0]!;
    const text = await readFileText(file);
    setFileName(file.name);
    setCsvText(text);
    setPreview(null);
    setTcxPreview(null);
    await requestPreview(text);
  }

  async function callFitBatch(payloads: string[], mode: 'preview' | 'confirm') {
    const res = await fetch('/api/import/fit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fits: payloads, mode }),
    });
    const json = (await res.json().catch(() => null)) as
      | (FitBatchPreview & {
          createdSessions?: number;
          createdSets?: number;
          createdExercises?: number;
          skipped?: number;
          error?: string;
        })
      | null;
    if (!res.ok) throw new Error(json?.error ?? `Error ${res.status}`);
    return json;
  }

  async function requestFitPreview(payloads: string[]) {
    setBusy(true);
    try {
      const json = await callFitBatch(payloads, 'preview');
      if (json) setFitBatch(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Preview failed.');
      setFitPayloads(null);
      setFileName(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmFitBatch() {
    if (!fitPayloads) return;
    setBusy(true);
    try {
      const json = await callFitBatch(fitPayloads, 'confirm');
      const sessions = json?.createdSessions ?? 0;
      const newEx = json?.createdExercises ?? 0;
      const skipped = json?.skipped ?? 0;
      toast.success(
        `Imported ${sessions} session${sessions === 1 ? '' : 's'}` +
          (newEx > 0 ? `, ${newEx} new exercise${newEx === 1 ? '' : 's'}` : '') +
          (skipped > 0 ? ` (${skipped} file${skipped === 1 ? '' : 's'} skipped).` : '.'),
      );
      resetPreviews();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  async function callApi(fileText: string, mode: 'preview' | 'confirm') {
    const res = await fetch(meta.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Each route's Zod schema defines its exact body: TCX carries the file as
      // xml, GPX as gpx; the CSV routes as csv (unit only where the app exports
      // both).
      body: JSON.stringify(
        isTcx
          ? { xml: fileText, mode }
          : isGpx
            ? { gpx: fileText, mode }
            : meta.hasUnitToggle
              ? { csv: fileText, unit, mode }
              : { csv: fileText, mode },
      ),
    });
    const json = (await res.json().catch(() => null)) as
      | (Preview &
          TcxPreview & {
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

  async function requestPreview(fileText: string) {
    setBusy(true);
    try {
      const json = await callApi(fileText, 'preview');
      // TCX/GPX are single-activity cardio (FIT has its own batch path).
      if (json && (isTcx || isGpx)) setTcxPreview(json);
      else if (json) setPreview(json);
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
        `Imported ${json?.createdSessions ?? 0} session${
          (json?.createdSessions ?? 0) === 1 ? '' : 's'
        }, ${json?.createdSets ?? 0} set${(json?.createdSets ?? 0) === 1 ? '' : 's'}` +
          ((json?.createdExercises ?? 0) > 0
            ? `, ${json?.createdExercises} new exercise${
                (json?.createdExercises ?? 0) === 1 ? '' : 's'
              }.`
            : '.'),
      );
      setCsvText(null);
      setFileName(null);
      setPreview(null);
      setTcxPreview(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    resetPreviews();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold">
          {isCardioActivity ? `Import a ${meta.fileKind} activity` : `Import from ${meta.label}`}
        </h2>
        <p className="text-xs text-muted-foreground">
          {isCardioActivity
            ? `Bring a cardio workout: ${meta.exportHint}. Preview it here, then confirm.`
            : `Bring your training history from ${meta.source}: ${meta.exportHint}, preview it here, then confirm.`}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="import-format">Source app</Label>
            <Select
              value={format}
              onValueChange={(v) => switchFormat(v as ImportFormat)}
            >
              <SelectTrigger id="import-format" className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STRONG">Strong</SelectItem>
                <SelectItem value="HEVY">Hevy</SelectItem>
                <SelectItem value="GYMCOACH">GymCoach CSV</SelectItem>
                <SelectItem value="TCX">TCX file</SelectItem>
                <SelectItem value="GPX">GPX file</SelectItem>
                <SelectItem value="FIT">FIT file</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {meta.hasUnitToggle && (
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
          )}
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
            <span className="ml-2">
              {isFit
                ? 'Choose FIT files'
                : isCardioActivity
                  ? `Choose a ${meta.fileKind} file`
                  : `Choose a ${meta.label} ${meta.fileKind} file`}
            </span>
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={meta.accept}
          // FIT supports importing a batch of activities at once (issue #253).
          multiple={isFit}
          className="hidden"
          onChange={onFilePicked}
        />

        {fitBatch && (
          <div className="rounded-md border p-3 text-sm" data-testid="import-preview">
            <p className="font-medium">
              {fitBatch.importable} activit{fitBatch.importable === 1 ? 'y' : 'ies'} to import
              {fitBatch.skipped > 0 ? ` · ${fitBatch.skipped} skipped` : ''}
            </p>
            <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5">
              {fitBatch.activities.map((a) =>
                a.ok ? (
                  <li key={a.index}>
                    {a.sport} on{' '}
                    {new Intl.DateTimeFormat('en-US', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(a.startedAt!))}{' '}
                    · {formatCardioSet(a.durationSec!, a.distanceM ?? null)}
                    {a.avgHr != null ? ` · avg HR ${a.avgHr} bpm` : ''}
                    {a.maxHr != null ? ` · max HR ${a.maxHr} bpm` : ''} logged as {a.exerciseName}
                    {a.duplicateSessions && a.duplicateSessions.length > 0 ? (
                      <span className="text-amber-700 dark:text-amber-400">
                        {' '}
                        (possible duplicate)
                      </span>
                    ) : null}
                  </li>
                ) : (
                  <li key={a.index} className="text-amber-700 dark:text-amber-400">
                    File {a.index + 1} skipped: {a.error}
                  </li>
                ),
              )}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={confirmFitBatch}
                disabled={busy || fitBatch.importable === 0}
                className="min-h-tap"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                <span className={busy ? 'ml-2' : ''}>
                  Import {fitBatch.importable} session{fitBatch.importable === 1 ? '' : 's'}
                </span>
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {tcxPreview && (
          <div className="rounded-md border p-3 text-sm" data-testid="import-preview">
            <p className="font-medium">
              Preview of <code>{fileName}</code>
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                1 cardio session ({tcxPreview.sport}) on{' '}
                {new Intl.DateTimeFormat('en-US', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(tcxPreview.startedAt))}
              </li>
              <li>
                {formatCardioSet(tcxPreview.durationSec, tcxPreview.distanceM)}
                {tcxPreview.avgHr != null ? ` · avg HR ${tcxPreview.avgHr} bpm` : ''}
                {tcxPreview.maxHr != null ? ` · max HR ${tcxPreview.maxHr} bpm` : ''}{' '}
                logged as {tcxPreview.exerciseName}
              </li>
              {tcxPreview.duplicateSessions.length > 0 && (
                <li className="text-amber-700 dark:text-amber-400">
                  Possible duplicate: you already have a session starting within 2
                  minutes of this activity.
                </li>
              )}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={confirmImport} disabled={busy} className="min-h-tap">
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                <span className={busy ? 'ml-2' : ''}>Confirm import</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}

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
              {preview.cardioSets > 0 && (
                <li>
                  {preview.cardioSets} cardio set{preview.cardioSets === 1 ? '' : 's'}{' '}
                  (duration/distance) included
                </li>
              )}
              {preview.cardioSkipped > 0 && (
                <li>
                  {preview.cardioSkipped} cardio row
                  {preview.cardioSkipped === 1 ? '' : 's'} without a usable duration will
                  be skipped
                </li>
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
