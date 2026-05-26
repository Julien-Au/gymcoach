'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Props {
  sessionId: string;
  workoutName: string | null;
  startedAt: Date;
}

export function DeleteSessionButton({ sessionId, workoutName, startedAt }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const formatted = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(startedAt);

  async function handleDelete() {
    setPending(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Erreur ${res.status}`);
      }
      toast.success('Séance supprimée.');
      router.push('/history');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Échec de la suppression.');
      setPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
        >
          <Trash2 className="size-4" />
          <span className="ml-1">Supprimer</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette séance ?</AlertDialogTitle>
          <AlertDialogDescription>
            La séance <strong>{workoutName ?? 'libre'}</strong> du {formatted} et
            toutes ses séries seront supprimées définitivement. Action
            irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={pending}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span className="ml-2">Suppression...</span>
              </>
            ) : (
              'Oui, supprimer'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
