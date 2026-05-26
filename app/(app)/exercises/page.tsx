import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ExercisesView } from '@/components/exercises/exercises-view';

export default async function ExercisesPage() {
  const session = await requireSession();
  const exercises = await db.exercise.findMany({
    where: { userId: session.userId },
    orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }],
  });

  return (
    <main className="flex-1 px-4 py-6">
      <ExercisesView exercises={exercises} />
    </main>
  );
}
