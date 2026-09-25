'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearSessionCaches } from '@/lib/pwa-cache';

export function LogoutButton() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Purge the Workbox runtime caches: they hold this user's GET /api/*
      // responses and page documents, which must not leak to the next
      // sign-in on a shared device.
      await clearSessionCaches();
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
      aria-label={t('logout')}
    >
      <LogOut className="size-4" />
      <span className="ml-2 hidden sm:inline">{t('logout')}</span>
    </Button>
  );
}
