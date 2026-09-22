import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createGymCoachMcpServer } from '@/lib/mcp/server';
import { addWorkoutToProgram, buildProgramFromGenerated } from '@/lib/program-generation';
import type { GeneratedWorkout } from '@/lib/schemas/program-generation';

// An external agent asked to "add a cardio session" to the trainee's program
// used to have only create_program (a whole new, inactive program) or
// add_program_exercise (one exercise inside an existing day). add_workout
// appends a real session to the program the trainee already follows.

const openServers: Array<ReturnType<typeof createGymCoachMcpServer>> = [];
const openClients: Client[] = [];

afterEach(async () => {
  await Promise.allSettled(openClients.splice(0).map((client) => client.close()));
  await Promise.allSettled(openServers.splice(0).map((server) => server.close()));
});

async function connect(userId: string, canWrite = true) {
  const server = createGymCoachMcpServer({
    principal: { tokenId: `token-${userId}`, userId, canWrite },
    baseUrl: 'https://gymcoach.example',
  });
  const client = new Client({ name: 'gymcoach-test', version: '1.0.0' });
  openServers.push(server);
  openClients.push(client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

async function makeUserWithProgram(email: string, active: boolean) {
  const user = await db.user.create({ data: { email, passwordHash: 'x' } });
  const programId = await buildProgramFromGenerated(user.id, {
    name: 'Upper / Lower',
    phase: 'Hypertrophy',
    workouts: [
      {
        name: 'Upper',
        dayOfWeek: 1,
        exercises: [
          {
            name: 'Barbell bench press',
            muscleGroup: 'CHEST',
            category: 'COMPOUND',
            targetSets: 4,
            targetRepsMin: 6,
            targetRepsMax: 10,
            targetRIR: 2,
            restSec: 120,
          },
        ],
      },
      {
        name: 'Lower',
        dayOfWeek: 3,
        exercises: [
          {
            name: 'Back Squat',
            muscleGroup: 'QUADS',
            category: 'COMPOUND',
            targetSets: 4,
            targetRepsMin: 5,
            targetRepsMax: 8,
            targetRIR: 2,
            restSec: 180,
          },
        ],
      },
    ],
  });
  if (active) await db.program.update({ where: { id: programId }, data: { isActive: true } });
  return { user, programId };
}

const cardioDay: GeneratedWorkout = {
  name: 'Cardio',
  dayOfWeek: 5,
  exercises: [
    {
      name: 'Treadmill run',
      muscleGroup: 'OTHER',
      // The model says COMPOUND; a CARDIO machine is always logged as cardio.
      category: 'COMPOUND',
      equipmentType: 'CARDIO',
      targetSets: 1,
      targetRepsMin: 1,
      targetRepsMax: 1,
      targetRIR: 0,
      restSec: 60,
      notes: '30 min easy pace',
    },
  ],
};

describe('addWorkoutToProgram', () => {
  it('appends the workout after the last one and applies the cardio rule', async () => {
    const { user, programId } = await makeUserWithProgram('add@test.dev', false);

    const workoutId = await addWorkoutToProgram(user.id, programId, cardioDay);

    const workouts = await db.workout.findMany({
      where: { programId },
      orderBy: { order: 'asc' },
      include: { exercises: { include: { exercise: true } } },
    });
    expect(workouts.map((w) => [w.name, w.order])).toEqual([
      ['Upper', 1],
      ['Lower', 2],
      ['Cardio', 3],
    ]);
    const added = workouts[2]!;
    expect(added.id).toBe(workoutId);
    expect(added.dayOfWeek).toBe(5);
    expect(added.exercises).toHaveLength(1);
    expect(added.exercises[0]!.exercise.category).toBe('CARDIO');
    expect(added.exercises[0]!.exercise.equipmentType).toBe('CARDIO');
    expect(added.exercises[0]!.notes).toBe('30 min easy pace');
  });

  it('reuses an existing exercise by name and targets an explicit inactive program', async () => {
    const { user, programId } = await makeUserWithProgram('reuse@test.dev', false);
    const before = await db.exercise.count({ where: { userId: user.id } });

    const workoutId = await addWorkoutToProgram(user.id, programId, {
      name: 'Upper B',
      exercises: [
        {
          // Same name as the existing 'Upper' day: the Exercise row is reused,
          // not duplicated, and its stored category/equipment are kept.
          name: 'Barbell bench press',
          muscleGroup: 'CHEST',
          category: 'ISOLATION',
          targetSets: 3,
          targetRepsMin: 8,
          targetRepsMax: 12,
          targetRIR: 2,
          restSec: 90,
        },
      ],
    });

    expect(await db.exercise.count({ where: { userId: user.id } })).toBe(before);
    const added = await db.workout.findUnique({
      where: { id: workoutId },
      include: { exercises: { include: { exercise: true } } },
    });
    expect(added?.programId).toBe(programId);
    expect(added?.order).toBe(3);
    expect(added?.exercises[0]!.exercise.category).toBe('COMPOUND');
  });

  it('refuses a program the user does not own', async () => {
    const { programId } = await makeUserWithProgram('owner@test.dev', false);
    const other = await db.user.create({ data: { email: 'other@test.dev', passwordHash: 'x' } });

    await expect(addWorkoutToProgram(other.id, programId, cardioDay)).rejects.toThrow(
      'Program not found.',
    );
    expect(await db.workout.count({ where: { programId } })).toBe(2);
  });
});

describe('MCP add_workout', () => {
  it('adds a session to the active program when programId is omitted', async () => {
    const { user, programId } = await makeUserWithProgram('mcp@test.dev', true);
    const client = await connect(user.id);

    const response = await client.callTool({
      name: 'add_workout',
      arguments: { confirmed: true, workout: cardioDay },
    });

    expect(response.isError).toBeFalsy();
    const structured = response.structuredContent as {
      ok: boolean;
      programId: string;
      workout: { name: string; order: number; exercises: Array<{ exercise: { name: string } }> };
    };
    expect(structured.ok).toBe(true);
    expect(structured.programId).toBe(programId);
    expect(structured.workout.name).toBe('Cardio');
    expect(structured.workout.order).toBe(3);
    expect(structured.workout.exercises.map((e) => e.exercise.name)).toEqual(['Treadmill run']);

    // The program is still the trainee's active one: nothing new to activate.
    const program = await db.program.findUnique({ where: { id: programId } });
    expect(program?.isActive).toBe(true);
    expect(await db.program.count({ where: { userId: user.id } })).toBe(1);
  });

  it('errors without an active program and without a programId', async () => {
    const { user } = await makeUserWithProgram('inactive@test.dev', false);
    const client = await connect(user.id);

    const response = await client.callTool({
      name: 'add_workout',
      arguments: { confirmed: true, workout: cardioDay },
    });
    expect(response.isError).toBe(true);
    expect(JSON.stringify(response.content)).toContain('No active program.');
  });

  it('adds to an explicit inactive program without touching the active one', async () => {
    const { user, programId: activeId } = await makeUserWithProgram('explicit@test.dev', true);
    const draftId = await buildProgramFromGenerated(user.id, {
      name: 'Draft',
      phase: 'Base',
      workouts: [
        {
          name: 'Full body',
          exercises: [
            {
              name: 'Back Squat',
              muscleGroup: 'QUADS',
              category: 'COMPOUND',
              targetSets: 3,
              targetRepsMin: 5,
              targetRepsMax: 8,
              targetRIR: 2,
              restSec: 180,
            },
          ],
        },
      ],
    });
    const client = await connect(user.id);

    const response = await client.callTool({
      name: 'add_workout',
      arguments: { confirmed: true, programId: draftId, workout: cardioDay },
    });

    expect(response.isError).toBeFalsy();
    expect((response.structuredContent as { programId: string }).programId).toBe(draftId);
    expect(await db.workout.count({ where: { programId: draftId } })).toBe(2);
    expect(await db.workout.count({ where: { programId: activeId } })).toBe(2);
  });

  it("cannot write into another user's program by id", async () => {
    const { programId } = await makeUserWithProgram('victim@test.dev', true);
    const attacker = await db.user.create({
      data: { email: 'attacker@test.dev', passwordHash: 'x' },
    });
    const client = await connect(attacker.id);

    const response = await client.callTool({
      name: 'add_workout',
      arguments: { confirmed: true, programId, workout: cardioDay },
    });
    expect(response.isError).toBe(true);
    expect(await db.workout.count({ where: { programId } })).toBe(2);
  });

  it('is refused on a read-only token', async () => {
    const { user, programId } = await makeUserWithProgram('readonly@test.dev', true);
    const client = await connect(user.id, false);

    const response = await client.callTool({
      name: 'add_workout',
      arguments: { confirmed: true, workout: cardioDay },
    });
    expect(response.isError).toBe(true);
    expect(JSON.stringify(response.content)).toContain('read-only');
    expect(await db.workout.count({ where: { programId } })).toBe(2);
  });
});
