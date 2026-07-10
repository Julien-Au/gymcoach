import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { generatedProgramSchema } from '@/lib/schemas/program-generation';
import { defaultIntraSetConfig } from '@/lib/intra-set-autoregulation';

export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const data = await parseJsonBody(req, generatedProgramSchema);

    const program = await db.$transaction(async (tx) => {
      await tx.program.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });

      const createdProgram = await tx.program.create({
        data: {
          userId,
          name: data.name,
          description: data.description ?? null,
          phase: data.phase,
          isActive: true,
        },
      });

      for (const [workoutIndex, workout] of data.workouts.entries()) {
        const createdWorkout = await tx.workout.create({
          data: {
            programId: createdProgram.id,
            name: workout.name,
            dayOfWeek: workout.dayOfWeek ?? null,
            order: workoutIndex + 1,
          },
        });

        for (const [exerciseIndex, exercise] of workout.exercises.entries()) {
          const createdExercise = await tx.exercise.upsert({
            where: {
              userId_name: {
                userId,
                name: exercise.name,
              },
            },
            update: {
              muscleGroup: exercise.muscleGroup,
              category: exercise.category,
              defaultRestSec: exercise.restSec,
              notes: exercise.notes ?? undefined,
            },
            create: {
              userId,
              name: exercise.name,
              muscleGroup: exercise.muscleGroup,
              category: exercise.category,
              defaultRestSec: exercise.restSec,
              notes: exercise.notes ?? null,
            },
          });

          await tx.programExercise.create({
            data: {
              workoutId: createdWorkout.id,
              exerciseId: createdExercise.id,
              order: exerciseIndex + 1,
              targetSets: exercise.targetSets,
              targetRepsMin: exercise.targetRepsMin,
              targetRepsMax: exercise.targetRepsMax,
              targetRIR: exercise.targetRIR,
              restSec: exercise.restSec,
              autoregulationMode: exercise.autoregulationMode ?? 'PRESERVE_RIR',
              fatigueRate:
                exercise.fatigueRate ?? defaultIntraSetConfig(createdExercise).fatigueRate,
              loadAdjustmentPct:
                exercise.loadAdjustmentPct ??
                defaultIntraSetConfig(createdExercise).loadAdjustmentPct,
              tempo: exercise.tempo ?? null,
              notes: exercise.notes ?? null,
              supersetGroup: exercise.supersetGroup ?? null,
            },
          });
        }
      }

      return createdProgram;
    });

    return NextResponse.json(program, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
