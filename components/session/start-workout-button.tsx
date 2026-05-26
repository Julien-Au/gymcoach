'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? 'Could not start the session.');
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
      <span className="ml-2">{isPending ? 'Starting...' : 'Start this session'}</span>
    </Button>
  );
}
