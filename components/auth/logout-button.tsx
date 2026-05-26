'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={isPending}
      aria-label="Déconnexion"
    >
      <LogOut className="size-4" />
      <span className="ml-2 hidden sm:inline">Déconnexion</span>
    </Button>
  );
}
