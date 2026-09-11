import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { unitLabel } from '@/lib/units';
import { getExerciseDisplayName } from '@/i18n/exercise-names';
import { getTrainingDisplayName } from '@/i18n/training-names';
import { PrintSheet, type PrintSheetLabels } from '@/components/programs/print-sheet';
import { PrintSheetToolbar } from '@/components/programs/print-sheet-toolbar';

// Printable A4 workout sheet (issue #333). One page per workout; `?workout=<id>`
// narrows the sheet to a single session of the program.

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ workout?: string | string[] }>;
}

export default async function ProgramPrintPage(props: Props) {
  const [params, searchParams, session, t, locale] = await Promise.all([
    props.params,
    props.searchParams,
    requireSession(),
    getTranslations('programs.print'),
    getLocale(),
  ]);

  const [program, user] = await Promise.all([
    db.program.findFirst({
      where: { id: params.id, userId: session.userId },
      include: {
        workouts: {
          orderBy: { order: 'asc' },
          include: {
            exercises: {
              orderBy: { order: 'asc' },
              include: { exercise: { select: { name: true } } },
            },
          },
        },
      },
    }),
    db.user.findUnique({ where: { id: session.userId }, select: { unit: true } }),
  ]);
  if (!program || !user) notFound();

  const requested = Array.isArray(searchParams.workout)
    ? searchParams.workout[0]
    : searchParams.workout;
  const workouts = requested
    ? program.workouts.filter((w) => w.id === requested)
    : program.workouts;
  if (requested && workouts.length === 0) notFound();

  const labels: PrintSheetLabels = {
    date: t('date'),
    exercise: t('exercise'),
    plan: t('plan'),
    set: (n) => t('set', { n }),
    weight: unitLabel(user.unit),
    reps: t('reps'),
    rir: t('rir'),
    notes: t('notes'),
    planLine: ({ sets, min, max, rir }) => t('planLine', { sets, min, max, rir }),
    rest: (seconds) => t('rest', { seconds }),
    tempo: (tempo) => t('tempo', { tempo }),
    empty: t('empty'),
  };
  const programName = getTrainingDisplayName(program.name, locale);

  return (
    <main className="mx-auto flex max-w-[210mm] flex-col gap-4 px-4 py-6 print:max-w-none print:gap-0 print:p-0">
      <PrintSheetToolbar programId={program.id} />
      {workouts.length === 0 ? (
        <p className="text-sm">{t('noWorkouts')}</p>
      ) : (
        workouts.map((workout, index) => (
          <PrintSheet
            key={workout.id}
            programName={programName}
            workout={{
              id: workout.id,
              name: getTrainingDisplayName(workout.name, locale),
              exercises: workout.exercises,
            }}
            labels={labels}
            exerciseName={(name) => getExerciseDisplayName(name, locale)}
            breakAfter={index < workouts.length - 1}
          />
        ))
      )}
    </main>
  );
}
