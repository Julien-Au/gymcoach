'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { MessageSquarePlus } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { COACH_NOTE_MAX_LEN } from '@/lib/schemas/profile';

interface Props {
  initialNote: string | null;
}

// "Note to your coach" (issue #188): a short free-text note the user writes to
// the AI coach as their own current context (injuries, illness, life
// constraints). It is part of "what your coach sees" - correctable AI memory.
// Saves through PATCH /api/profile (ownership-scoped, Zod-bounded server-side).
export function CoachNoteCard({ initialNote }: Props) {
  const [note, setNote] = useState(initialNote ?? '');
  const [saved, setSaved] = useState(initialNote ?? '');
  const [busy, setBusy] = useState(false);

  const trimmed = note.trim();
  const dirty = trimmed !== saved.trim();
  const overLimit = note.length > COACH_NOTE_MAX_LEN;

  async function persist(value: string | null) {
    setBusy(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachNote: value }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Could not save your note.');
        return false;
      }
      return true;
    } catch {
      toast.error('Could not save your note.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (overLimit) return;
    // Empty after trim is a clear; the server coerces "" to null all the same.
    const value = trimmed.length > 0 ? trimmed : null;
    if (await persist(value)) {
      setNote(value ?? '');
      setSaved(value ?? '');
      toast.success(value ? 'Note saved.' : 'Note cleared.');
    }
  }

  async function handleClear() {
    if (await persist(null)) {
      setNote('');
      setSaved('');
      toast.success('Note cleared.');
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="size-4 text-primary" />
          <h2 className="text-base font-semibold">Note to your coach</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Your own current context for the coach to weigh - an injury, an
          illness, travel, anything the data does not show. The coach reads this
          alongside your training history.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          aria-label="Note to your coach"
          placeholder="e.g. Shoulder is bothering me, go easy on pressing this week."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={COACH_NOTE_MAX_LEN}
        />
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-xs tabular-nums ${
              overLimit ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {note.length}/{COACH_NOTE_MAX_LEN}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              disabled={busy || (saved.trim().length === 0 && trimmed.length === 0)}
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={busy || overLimit || !dirty}
            >
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
