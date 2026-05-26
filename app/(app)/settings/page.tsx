import { Settings as SettingsIcon } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SettingsClient } from '@/components/settings/settings-client';
import { ProfileSection } from '@/components/settings/profile-section';

export default async function SettingsPage() {
  const auth = await requireSession();
  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { bodyweight: true },
  });

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="size-6" />
          <h1 className="text-2xl font-bold tracking-tight">Réglages</h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold">Compte</h2>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{auth.email}</span>
            </div>
          </CardContent>
        </Card>

        <ProfileSection initialBodyweight={user?.bodyweight ?? null} />

        <SettingsClient />
      </div>
    </main>
  );
}
