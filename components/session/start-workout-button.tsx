'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function StartWorkoutButton({
  workoutId,
  disabled,
}: {
  workoutId: string;
  disabled?: boolean;
}) {
  const t = useTranslations('session');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleStart() {
    startTransition(async () => {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutId }),
      });
      if (!res.ok) {
        toast.error(t('startError'));
        return;
      }
      const session = (await res.json()) as { id: string };
      router.push(`/session/${session.id}`);
      router.refresh();
    });
  }

  return (
    <Button
      onClick={handleStart}
      disabled={disabled || isPending}
      className="min-h-tap w-full text-base"
    >
      <Play className="size-5" />
      <span className="ml-2">{isPending ? t('starting') : t('startThis')}</span>
    </Button>
  );
}
