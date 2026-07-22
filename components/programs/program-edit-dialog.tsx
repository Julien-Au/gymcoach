'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Program } from '@/lib/prisma-client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { programInputSchema, type ProgramInput } from '@/lib/schemas/program';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: Program;
}

export function ProgramEditDialog({ open, onOpenChange, program }: Props) {
  const t = useTranslations('programs');
  const common = useTranslations('common');
  const router = useRouter();
  const form = useForm<ProgramInput>({
    resolver: zodResolver(programInputSchema),
    defaultValues: {
      name: program.name,
      phase: program.phase,
      description: program.description ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: program.name,
        phase: program.phase,
        description: program.description ?? '',
      });
    }
  }, [open, program, form]);

  async function onSubmit(values: ProgramInput) {
    const res = await fetch(`/api/programs/${program.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, description: values.description || null }),
    });
    if (!res.ok) {
      toast.error(t('saveError'));
      return;
    }
    toast.success(t('updated'));
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editProgram')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">{common('fields.name')}</Label>
            <Input id="name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phase">{t('phase')}</Label>
            <Input id="phase" {...form.register('phase')} />
            {form.formState.errors.phase && (
              <p className="text-sm text-destructive">{form.formState.errors.phase.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{common('fields.description')}</Label>
            <Textarea id="description" rows={3} {...form.register('description')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {common('actions.cancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? common('actions.saving') : common('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
