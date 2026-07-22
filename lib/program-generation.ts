import { db } from '@/lib/db';
import { getLlmProvider, LlmError } from '@/lib/llm';
import { PROGRAM_GEN_SYSTEM_PROMPT } from '@/lib/prompts/program-system-prompt';
import { parseGeneratedProgram, type GeneratedProgram } from '@/lib/schemas/program-generation';
import { defaultIntraSetConfig } from '@/lib/intra-set-autoregulation';

// Generates a structured program draft from a natural-language goal. Does not
// persist anything: the result is previewed (and edited) before saving.
export async function generateProgram(userId: string, goal: string): Promise<GeneratedProgram> {
  const provider = getLlmProvider();

  const [user, exercises] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        sex: true,
        heightCm: true,
        bodyweight: true,
        goal: true,
        weeklyFrequency: true,
      },
    }),
    db.exercise.findMany({
      where: { userId },
      select: { name: true, muscleGroup: true, category: true, equipmentType: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const context = {
    profile: {
      sex: user?.sex ?? null,
      heightCm: user?.heightCm ?? null,
      bodyweight: user?.bodyweight ?? null,
      goal: user?.goal ?? null,
      weeklyFrequency: user?.weeklyFrequency ?? null,
    },
    availableExercises: exercises,
  };

  const userMessage = `User goal:\n${goal}\n\nContext (JSON):\n${JSON.stringify(context, null, 2)}`;

  const { text } = await provider.complete({
    system: PROGRAM_GEN_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 8000,
  });

  const parsed = parseGeneratedProgram(text);
  if (!parsed.ok) {
    throw new LlmError(502, `The generated program could not be parsed: ${parsed.error}`);
  }
  return parsed.program;
}

// Persists a (possibly user-edited) generated program in a single transaction.
// New exercises are created on the fly; existing ones are reused by name.
// Returns the new program id. The program is created inactive.
export async function buildProgramFromGenerated(
  userId: string,
  program: GeneratedProgram,
): Promise<string> {
  return db.$transaction(async (tx) => {
    const created = await tx.program.create({
      data: {
        userId,
        name: program.name,
        description: program.description ?? null,
        phase: program.phase,
        isActive: false,
      },
    });

    let workoutOrder = 1;
    for (const w of program.workouts) {
      const workout = await tx.workout.create({
        data: {
          programId: created.id,
          name: w.name,
          dayOfWeek: w.dayOfWeek ?? null,
          order: workoutOrder++,
        },
      });

      let exerciseOrder = 1;
      for (const ex of w.exercises) {
        const exercise = await tx.exercise.upsert({
          where: { userId_name: { userId, name: ex.name } },
          update: {},
          create: {
            userId,
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            category: ex.category,
            equipmentType: ex.equipmentType ?? 'OTHER',
            defaultRestSec: ex.restSec,
          },
        });

        const autoregDefaults = defaultIntraSetConfig(exercise);
        await tx.programExercise.create({
          data: {
            workoutId: workout.id,
            exerciseId: exercise.id,
            order: exerciseOrder++,
            targetSets: ex.targetSets,
            targetRepsMin: ex.targetRepsMin,
            targetRepsMax: Math.max(ex.targetRepsMax, ex.targetRepsMin),
            targetRIR: ex.targetRIR,
            restSec: ex.restSec,
            autoregulationMode: ex.autoregulationMode ?? 'PRESERVE_RIR',
            fatigueRate: ex.fatigueRate ?? autoregDefaults.fatigueRate,
            loadAdjustmentPct: ex.loadAdjustmentPct ?? autoregDefaults.loadAdjustmentPct,
            tempo: ex.tempo ?? null,
            notes: ex.notes ?? null,
            supersetGroup: ex.supersetGroup ?? null,
          },
        });
      }
    }

    return created.id;
  });
}
