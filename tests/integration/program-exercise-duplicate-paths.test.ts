import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { createGymCoachMcpServer } from '@/lib/mcp/server';
import { buildProgramFromGenerated } from '@/lib/program-generation';

// Issue #426: #425 refused a duplicate exercise on POST only. The live runner
// shares one set pool per exercise, so the other hand-edit paths refuse it
// too: the PUT that replaces a row's exercise and the MCP add tool. Program
// generation keeps deliberate repeats (5/3/1 Boring But Big, see #429).

vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { PUT as putProgramExercise } from '@/app/api/program-exercises/[id]/route';

const targets = {
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetRIR: 2,
  restSec: 90,
};

async function seed(email: string) {
  const user = await db.user.create({ data: { email, passwordHash: 'x' } });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const row = await db.exercise.create({
    data: { userId: user.id, name: 'Row', muscleGroup: 'BACK_THICKNESS', category: 'COMPOUND' },
  });
  const squat = await db.exercise.create({
    data: { userId: user.id, name: 'Squat', muscleGroup: 'QUADS', category: 'COMPOUND' },
  });
  const program = await db.program.create({
    data: { userId: user.id, name: 'P', phase: 'Base' },
  });
  const workout = await db.workout.create({
    data: { programId: program.id, name: 'Day A', order: 1 },
  });
  const benchRow = await db.programExercise.create({
    data: { workoutId: workout.id, exerciseId: bench.id, order: 1, ...targets },
  });
  const rowRow = await db.programExercise.create({
    data: { workoutId: workout.id, exerciseId: row.id, order: 2, ...targets },
  });
  return { user, bench, row, squat, workout, benchRow, rowRow };
}

function put(id: string, body: unknown) {
  return putProgramExercise(
    new Request('http://test.local/api', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe('PUT /api/program-exercises/[id] (issue #426)', () => {
  it('refuses replacing an exercise with one the workout already holds', async () => {
    const { user, bench, rowRow } = await seed('put-dup@test.dev');
    mockUserId.mockResolvedValue(user.id);

    const res = await put(rowRow.id, { exerciseId: bench.id, ...targets });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('That exercise is already in this workout.');
    // The refusal wrote nothing.
    const after = await db.programExercise.findUnique({ where: { id: rowRow.id } });
    expect(after?.exerciseId).not.toBe(bench.id);
    expect(await db.programExercise.count({ where: { exerciseId: bench.id } })).toBe(1);
  });

  it('still saves an edit that keeps the row on its own exercise', async () => {
    const { user, bench, benchRow } = await seed('put-self@test.dev');
    mockUserId.mockResolvedValue(user.id);

    const res = await put(benchRow.id, { exerciseId: bench.id, ...targets, targetSets: 5 });
    expect(res.status).toBe(200);
    expect((await db.programExercise.findUnique({ where: { id: benchRow.id } }))?.targetSets).toBe(
      5,
    );
  });

  it('still saves a targets-only edit on a workout that already holds a duplicate', async () => {
    // Rows written before the duplicate checks existed may share an exercise;
    // editing one of them without changing its exercise must not be refused.
    const { user, bench, benchRow, workout } = await seed('put-legacy-dup@test.dev');
    await db.programExercise.create({
      data: { workoutId: workout.id, exerciseId: bench.id, order: 3, ...targets },
    });
    mockUserId.mockResolvedValue(user.id);

    const res = await put(benchRow.id, { exerciseId: bench.id, ...targets, targetSets: 4 });
    expect(res.status).toBe(200);
    expect((await db.programExercise.findUnique({ where: { id: benchRow.id } }))?.targetSets).toBe(
      4,
    );
  });

  it('still replaces with an exercise the workout does not hold', async () => {
    const { user, squat, rowRow } = await seed('put-new@test.dev');
    mockUserId.mockResolvedValue(user.id);

    const res = await put(rowRow.id, { exerciseId: squat.id, ...targets });
    expect(res.status).toBe(200);
    expect((await db.programExercise.findUnique({ where: { id: rowRow.id } }))?.exerciseId).toBe(
      squat.id,
    );
  });
});

const openServers: Array<ReturnType<typeof createGymCoachMcpServer>> = [];
const openClients: Client[] = [];

afterEach(async () => {
  await Promise.allSettled(openClients.splice(0).map((client) => client.close()));
  await Promise.allSettled(openServers.splice(0).map((server) => server.close()));
});

async function connect(userId: string) {
  const server = createGymCoachMcpServer({
    principal: { tokenId: `token-${userId}`, userId, canWrite: true },
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

const generatedTargets = {
  muscleGroup: 'CHEST' as const,
  category: 'COMPOUND' as const,
  ...targets,
};

describe('MCP add_program_exercise (issue #426)', () => {
  it('refuses an exercise the workout already holds and writes nothing', async () => {
    const { user, workout } = await seed('mcp-dup@test.dev');
    const client = await connect(user.id);

    const response = await client.callTool({
      name: 'add_program_exercise',
      arguments: {
        confirmed: true,
        workoutId: workout.id,
        exercise: { name: 'Bench', ...generatedTargets },
      },
    });
    expect(response.isError).toBe(true);
    expect(JSON.stringify(response.content)).toContain('already in this workout');
    expect(await db.programExercise.count({ where: { workoutId: workout.id } })).toBe(2);
  });

  it('still adds an exercise the workout does not hold', async () => {
    const { user, workout } = await seed('mcp-new@test.dev');
    const client = await connect(user.id);

    const response = await client.callTool({
      name: 'add_program_exercise',
      arguments: {
        confirmed: true,
        workoutId: workout.id,
        exercise: { name: 'Squat', ...generatedTargets, muscleGroup: 'QUADS' },
      },
    });
    expect(response.isError).toBeFalsy();
    expect(await db.programExercise.count({ where: { workoutId: workout.id } })).toBe(3);
  });
});

describe('program generation (issue #426)', () => {
  it('keeps a deliberate repeat of an exercise in one workout', async () => {
    // Templates such as 5/3/1 Boring But Big program the main lift twice in
    // one workout (the 5/3/1 sets, then the 5x10), so generation keeps every
    // row; only the hand-edit paths refuse a duplicate.
    const user = await db.user.create({ data: { email: 'gen-dup@test.dev', passwordHash: 'x' } });
    const programId = await buildProgramFromGenerated(user.id, {
      name: 'Generated',
      phase: 'Base',
      workouts: [
        {
          name: 'Press day',
          dayOfWeek: 1,
          exercises: [
            { name: 'Bench', ...generatedTargets, targetSets: 3 },
            { name: 'Bench', ...generatedTargets, targetSets: 5 },
            { name: 'Row', ...generatedTargets },
          ],
        },
      ],
    });

    const workout = await db.workout.findFirstOrThrow({
      where: { programId },
      include: { exercises: { orderBy: { order: 'asc' }, include: { exercise: true } } },
    });
    expect(workout.exercises.map((pe) => pe.exercise.name)).toEqual(['Bench', 'Bench', 'Row']);
    expect(workout.exercises.map((pe) => pe.targetSets)).toEqual([3, 5, 3]);
  });
});
