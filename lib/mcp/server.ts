import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { db } from '@/lib/db';
import { buildCoachPayload } from '@/lib/coach';
import { buildProgramFromGenerated } from '@/lib/program-generation';
import { generatedExerciseSchema, generatedProgramSchema } from '@/lib/schemas/program-generation';
import { programInputSchema } from '@/lib/schemas/program';
import {
  EquipmentType,
  ExerciseCategory,
  MuscleGroup,
  SetAutoregulationMode,
} from '@/lib/prisma-client';
import type { McpPrincipal } from '@/lib/mcp/auth';

export const GYMCOACH_MCP_INSTRUCTIONS = `GymCoach stores the trainee's profile, gyms, equipment, programs, workout history, sets, RIR, goals and recovery signals.

Use read tools before making recommendations. Ground every recommendation in returned GymCoach data and never invent completed sets, available equipment, records or injuries. Respect the active gym's equipment constraints. Use the trainee's language.

Program-writing tools change saved data. Explain the proposed change before calling a write tool. Newly created programs are inactive so the trainee can review them. Activate a program only when the trainee explicitly asks. Never delete or remove a program exercise without explicit confirmation.`;

interface ServerOptions {
  principal: McpPrincipal;
  baseUrl: string;
}

const explicitConfirmation = z
  .literal(true)
  .describe('Set to true only after the trainee explicitly confirmed this saved-data change.');

function result(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function requireWrite(principal: McpPrincipal) {
  if (!principal.canWrite) {
    throw new Error(
      'This GymCoach MCP token is read-only. Create a write-enabled token in Settings.',
    );
  }
}

async function getOwnedProgram(userId: string, programId?: string) {
  const program = programId
    ? await db.program.findFirst({ where: { id: programId, userId }, select: { id: true } })
    : await db.program.findFirst({ where: { userId, isActive: true }, select: { id: true } });
  if (!program) throw new Error(programId ? 'Program not found.' : 'No active program.');
  return program.id;
}

export function createGymCoachMcpServer({ principal, baseUrl }: ServerOptions): McpServer {
  const server = new McpServer(
    {
      name: 'GymCoach',
      version: '1.0.0',
      websiteUrl: baseUrl,
    },
    { instructions: GYMCOACH_MCP_INSTRUCTIONS },
  );

  server.registerResource(
    'gymcoach-agent-instructions',
    'gymcoach://instructions/agent',
    {
      title: 'GymCoach agent instructions',
      description: 'Rules for safely analysing and editing the trainee training data.',
      mimeType: 'text/plain',
    },
    async () => ({
      contents: [
        {
          uri: 'gymcoach://instructions/agent',
          mimeType: 'text/plain',
          text: GYMCOACH_MCP_INSTRUCTIONS,
        },
      ],
    }),
  );

  server.registerPrompt(
    'build-training-program',
    {
      title: 'Build a GymCoach training program',
      description: 'Analyse the trainee context and prepare a structured program for GymCoach.',
      argsSchema: { goal: z.string().trim().min(5).max(2000) },
    },
    async ({ goal }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Goal: ${goal}\n\nFirst call get_training_context and list_exercises. Design a realistic program that respects the saved gym and equipment. Explain the draft, ask for confirmation, then call create_program.`,
          },
        },
      ],
    }),
  );

  server.registerTool(
    'get_training_context',
    {
      title: 'Get training context',
      description:
        'Returns the trainee profile, recent training, active program, records, goals, fatigue, readiness, conditioning and active gym equipment.',
      annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
    },
    async () => {
      const [coach, user] = await Promise.all([
        buildCoachPayload(principal.userId),
        db.user.findUnique({
          where: { id: principal.userId },
          select: {
            email: true,
            unit: true,
            activeGym: {
              include: {
                exerciseConfigs: {
                  orderBy: { exercise: { name: 'asc' } },
                  include: {
                    exercise: {
                      select: { id: true, name: true, equipmentType: true },
                    },
                  },
                },
              },
            },
          },
        }),
      ]);
      return result({
        instructionsVersion: 1,
        unit: user?.unit ?? 'KG',
        activeGym: user?.activeGym ?? null,
        coach,
      });
    },
  );

  server.registerTool(
    'list_exercises',
    {
      title: 'List exercise catalog',
      description: 'Lists the trainee exercise catalog with stable IDs and equipment categories.',
      inputSchema: {
        search: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(500).default(200),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
    },
    async ({ search, limit }) => {
      const exercises = await db.exercise.findMany({
        where: {
          userId: principal.userId,
          ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
        },
        orderBy: { name: 'asc' },
        take: limit,
        select: {
          id: true,
          name: true,
          muscleGroup: true,
          category: true,
          equipmentType: true,
          usesBodyweight: true,
          defaultRestSec: true,
          notes: true,
        },
      });
      return result({ exercises });
    },
  );

  server.registerTool(
    'list_programs',
    {
      title: 'List training programs',
      description: 'Lists saved programs and their workout counts.',
      annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
    },
    async () => {
      const programs = await db.program.findMany({
        where: { userId: principal.userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          phase: true,
          description: true,
          isActive: true,
          updatedAt: true,
          _count: { select: { workouts: true, sessions: true } },
        },
      });
      return result({ programs });
    },
  );

  server.registerTool(
    'get_program',
    {
      title: 'Get a training program',
      description: 'Returns a complete program with workout, exercise and autoregulation IDs.',
      inputSchema: {
        programId: z.string().cuid().optional().describe('Omit to read the active program.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
    },
    async ({ programId }) => {
      const id = await getOwnedProgram(principal.userId, programId);
      const program = await db.program.findUnique({
        where: { id },
        include: {
          workouts: {
            orderBy: { order: 'asc' },
            include: {
              exercises: {
                orderBy: { order: 'asc' },
                include: { exercise: true },
              },
            },
          },
        },
      });
      return result({ program });
    },
  );

  server.registerTool(
    'create_program',
    {
      title: 'Create training program',
      description:
        'Creates a complete inactive GymCoach program. Explain the draft and obtain user confirmation before calling.',
      inputSchema: { confirmed: explicitConfirmation, program: generatedProgramSchema },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ program }) => {
      requireWrite(principal);
      const id = await buildProgramFromGenerated(principal.userId, program);
      return result({ ok: true, programId: id, active: false });
    },
  );

  server.registerTool(
    'update_program_metadata',
    {
      title: 'Update program details',
      description: 'Updates a program name, phase and description after user confirmation.',
      inputSchema: {
        confirmed: explicitConfirmation,
        programId: z.string().cuid(),
        values: programInputSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ programId, values }) => {
      requireWrite(principal);
      await getOwnedProgram(principal.userId, programId);
      const program = await db.program.update({
        where: { id: programId },
        data: {
          name: values.name,
          phase: values.phase,
          description: values.description ?? null,
        },
      });
      return result({ ok: true, program });
    },
  );

  server.registerTool(
    'add_program_exercise',
    {
      title: 'Add program exercise',
      description: 'Adds an exercise to an existing workout after user confirmation.',
      inputSchema: {
        confirmed: explicitConfirmation,
        workoutId: z.string().cuid(),
        exercise: generatedExerciseSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ workoutId, exercise: input }) => {
      requireWrite(principal);
      const workout = await db.workout.findFirst({
        where: { id: workoutId, program: { userId: principal.userId } },
        select: { id: true },
      });
      if (!workout) throw new Error('Workout not found.');

      const created = await db.$transaction(async (tx) => {
        const exercise = await tx.exercise.upsert({
          where: { userId_name: { userId: principal.userId, name: input.name } },
          update: {},
          create: {
            userId: principal.userId,
            name: input.name,
            muscleGroup: input.muscleGroup,
            category: input.category,
            equipmentType: input.equipmentType ?? 'OTHER',
            defaultRestSec: input.restSec,
          },
        });
        const last = await tx.programExercise.findFirst({
          where: { workoutId },
          orderBy: { order: 'desc' },
          select: { order: true },
        });
        return tx.programExercise.create({
          data: {
            workoutId,
            exerciseId: exercise.id,
            order: (last?.order ?? 0) + 1,
            targetSets: input.targetSets,
            targetRepsMin: input.targetRepsMin,
            targetRepsMax: input.targetRepsMax,
            targetRIR: input.targetRIR,
            restSec: input.restSec,
            autoregulationMode: input.autoregulationMode ?? 'PRESERVE_RIR',
            fatigueRate: input.fatigueRate ?? null,
            loadAdjustmentPct: input.loadAdjustmentPct ?? null,
            supersetGroup: input.supersetGroup ?? null,
            tempo: input.tempo ?? null,
            notes: input.notes ?? null,
          },
          include: { exercise: true },
        });
      });
      return result({ ok: true, programExercise: created });
    },
  );

  server.registerTool(
    'update_program_exercise',
    {
      title: 'Update program exercise',
      description:
        'Changes targets and autoregulation for an existing program exercise after user confirmation.',
      inputSchema: {
        programExerciseId: z.string().cuid(),
        confirmed: explicitConfirmation,
        targetSets: z.number().int().min(1).max(20).optional(),
        targetRepsMin: z.number().int().min(1).max(50).optional(),
        targetRepsMax: z.number().int().min(1).max(50).optional(),
        targetRIR: z.number().int().min(0).max(5).optional(),
        restSec: z.number().int().min(15).max(600).optional(),
        autoregulationMode: z.nativeEnum(SetAutoregulationMode).optional(),
        fatigueRate: z.number().min(0.25).max(2).nullable().optional(),
        loadAdjustmentPct: z.number().min(1).max(5).nullable().optional(),
        supersetGroup: z.number().int().min(1).max(9).nullable().optional(),
        tempo: z.string().trim().max(20).nullable().optional(),
        notes: z.string().trim().max(2000).nullable().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ programExerciseId, confirmed: _confirmed, ...patch }) => {
      requireWrite(principal);
      const current = await db.programExercise.findFirst({
        where: { id: programExerciseId, workout: { program: { userId: principal.userId } } },
      });
      if (!current) throw new Error('Program exercise not found.');

      const min = patch.targetRepsMin ?? current.targetRepsMin;
      const max = patch.targetRepsMax ?? current.targetRepsMax;
      if (max < min)
        throw new Error('targetRepsMax must be greater than or equal to targetRepsMin.');

      const updated = await db.programExercise.update({
        where: { id: programExerciseId },
        data: patch,
        include: { exercise: true },
      });
      return result({ ok: true, programExercise: updated });
    },
  );

  server.registerTool(
    'remove_program_exercise',
    {
      title: 'Remove program exercise',
      description: 'Removes one exercise from a program. Requires explicit user confirmation.',
      inputSchema: { confirmed: explicitConfirmation, programExerciseId: z.string().cuid() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ programExerciseId }) => {
      requireWrite(principal);
      const current = await db.programExercise.findFirst({
        where: { id: programExerciseId, workout: { program: { userId: principal.userId } } },
        include: { exercise: { select: { name: true } } },
      });
      if (!current) throw new Error('Program exercise not found.');
      await db.programExercise.delete({ where: { id: programExerciseId } });
      return result({ ok: true, removedExercise: current.exercise.name });
    },
  );

  server.registerTool(
    'activate_program',
    {
      title: 'Activate training program',
      description: 'Makes a saved program active. Call only after explicit user confirmation.',
      inputSchema: { confirmed: explicitConfirmation, programId: z.string().cuid() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ programId }) => {
      requireWrite(principal);
      await getOwnedProgram(principal.userId, programId);
      await db.$transaction([
        db.program.updateMany({
          where: { userId: principal.userId, isActive: true, id: { not: programId } },
          data: { isActive: false },
        }),
        db.program.update({ where: { id: programId }, data: { isActive: true } }),
      ]);
      return result({ ok: true, programId, active: true });
    },
  );

  return server;
}

// Exported for schema documentation and future OAuth scopes.
export const MCP_ENUMS = {
  equipmentTypes: Object.values(EquipmentType),
  exerciseCategories: Object.values(ExerciseCategory),
  muscleGroups: Object.values(MuscleGroup),
};
