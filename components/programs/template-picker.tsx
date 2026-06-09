'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ProgramTemplate } from '@/lib/programs/templates';

interface Props {
  templates: ProgramTemplate[];
}

// "Start from a template" picker. Materializes the selected template into a
// real Program through the same /api/programs/build route the AI generator
// uses, so the structure is persisted exactly as written and the coach treats
// it like any user-authored program.
export function TemplatePicker({ templates }: Props) {
  const router = useRouter();
  const [creatingSlug, setCreatingSlug] = useState<string | null>(null);

  async function instantiate(template: ProgramTemplate) {
    setCreatingSlug(template.slug);
    try {
      const res = await fetch('/api/programs/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template.program),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const j = (await res.json()) as { id: string };
      toast.success('Program created from template.');
      router.push(`/programs/${j.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the program.');
      setCreatingSlug(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {templates.map((template) => {
        const dayCount = template.program.workouts.length;
        return (
          <Card key={template.slug}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{template.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{template.summary}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {dayCount} {dayCount === 1 ? 'day' : 'days'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">{template.attribution}</p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="min-h-tap"
                  disabled={creatingSlug !== null}
                  onClick={() => instantiate(template)}
                >
                  {creatingSlug === template.slug ? 'Creating...' : 'Use this template'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
