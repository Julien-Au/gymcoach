import Link from 'next/link';
import { Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ProgramsPage() {
  const session = await requireSession();
  const programs = await db.program.findMany({
    where: { userId: session.userId },
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    include: {
      _count: { select: { workouts: true, sessions: true } },
    },
  });

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Programmes</h1>
            <p className="text-sm text-muted-foreground">
              {programs.length} programme{programs.length > 1 ? 's' : ''}.
            </p>
          </div>
          <Button asChild className="min-h-tap">
            <Link href="/programs/new">
              <Plus className="size-4" />
              <span className="ml-2">Créer</span>
            </Link>
          </Button>
        </div>

        {programs.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aucun programme</CardTitle>
              <CardDescription>
                Crée ton premier programme pour pouvoir démarrer une séance.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {programs.map((p) => (
              <li key={p.id}>
                <Link href={`/programs/${p.id}`} className="block">
                  <Card className="transition-colors hover:bg-accent">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        {p.isActive && <Badge>Actif</Badge>}
                      </div>
                      <CardDescription className="text-xs">
                        {p.phase} · démarré le{' '}
                        {new Intl.DateTimeFormat('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        }).format(p.startDate)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 text-xs text-muted-foreground">
                      {p._count.workouts} séance{p._count.workouts > 1 ? 's' : ''} ·{' '}
                      {p._count.sessions} session{p._count.sessions > 1 ? 's' : ''} historique
                      {p._count.sessions > 1 ? 's' : ''}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
