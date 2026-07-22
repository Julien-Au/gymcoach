'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { programInputSchema, type ProgramInput } from '@/lib/schemas/program';

export function ProgramCreateForm() {
  const t = useTranslations('programs');
  const router = useRouter();
  const form = useForm<ProgramInput>({
    resolver: zodResolver(programInputSchema),
    defaultValues: { name: '', phase: 'Hypertrophy', description: '' },
  });

  async function onSubmit(values: ProgramInput) {
    const res = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, description: values.description || null }),
    });
    if (!res.ok) {
      toast.error(t('createError'));
      return;
    }
    const created = (await res.json()) as { id: string };
    toast.success(t('created'));
    router.push(`/programs/${created.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">{t('programName')}</Label>
            <Input
              id="name"
              placeholder={t('programNamePlaceholder')}
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phase">{t('phase')}</Label>
            <Input
              id="phase"
              placeholder={t('phasePlaceholder')}
              {...form.register('phase')}
            />
            {form.formState.errors.phase && (
              <p className="text-sm text-destructive">{form.formState.errors.phase.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('descriptionOptional')}</Label>
            <Textarea id="description" rows={3} {...form.register('description')} />
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="min-h-tap" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('creating') : t('createProgram')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
