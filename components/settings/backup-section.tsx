'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Download, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function BackupSection() {
  const t = useTranslations('settings.backup');
  const common = useTranslations('common');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmingFile, setConfirmingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gymcoach-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('exportDone'));
    } catch {
      toast.error(t('exportError'));
    } finally {
      setExporting(false);
    }
  }

  function pickFile() {
    fileRef.current?.click();
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (file) setConfirmingFile(file);
  }

  async function confirmImport() {
    if (!confirmingFile) return;
    setImporting(true);
    try {
      const text = await confirmingFile.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(t('invalidJson'));
      }
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, confirmReplace: true }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      toast.success(t('importDone'));
      setConfirmingFile(null);
      // Refresh the page to start from a clean state.
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('importError'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold">{t('title')}</h2>
        <p className="text-xs text-muted-foreground">
          {t('description')}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting}
          className="min-h-tap"
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          <span className="ml-2">{t('export')}</span>
        </Button>

        <Button
          variant="outline"
          onClick={pickFile}
          disabled={importing}
          className="min-h-tap"
        >
          <Upload className="size-4" />
          <span className="ml-2">{t('import')}</span>
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={onFilePicked}
        />

        {confirmingFile && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium">{t('confirmTitle')}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('confirmDescription', { file: confirmingFile.name })}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={confirmImport}
                    disabled={importing}
                    className="min-h-tap"
                  >
                    {importing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    <span className={importing ? 'ml-2' : ''}>
                      {t('replace')}
                    </span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmingFile(null)}
                    disabled={importing}
                  >
                    {common('actions.cancel')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
