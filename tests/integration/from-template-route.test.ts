import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
// Mock it so we can act as a user without real cookies/JWTs.
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as postFromTemplate } from '@/app/api/programs/from-template/route';

function actAs(userId: string | null) {
  mockUserId.mockResolvedValue(userId);
}

function jsonReq(body: unknown): Request {
  return new Request('http://test.local/api/programs/from-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const templatePayload = {
  name: 'Starter Full Body',
  description: 'Template instantiation test',
  phase: 'Hypertrophy',
  workouts: [
    {
      name: 'Day A',
      dayOfWeek: 1,
      exercises: [
        {
          name: 'Bench Press',
          muscleGroup: 'CHEST',
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
};

beforeEach(() => {
  mockUserId.mockReset();
});

describe('POST /api/programs/from-template', () => {
  it('creates the program with its workouts and activates it', async () => {
    const user = await db.user.create({
      data: { email: 'template@test.dev', passwordHash: 'x' },
    });
    const previous = await db.program.create({
      data: { userId: user.id, name: 'Old plan', phase: 'Base', isActive: true },
    });
    actAs(user.id);

    const res = await postFromTemplate(jsonReq(templatePayload));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };

    const program = await db.program.findUniqueOrThrow({
      where: { id },
      include: { workouts: { include: { exercises: true } } },
    });
    expect(program.userId).toBe(user.id);
    expect(program.isActive).toBe(true);
    expect(program.workouts).toHaveLength(1);
    expect(program.workouts[0]?.exercises).toHaveLength(1);

    const old = await db.program.findUniqueOrThrow({ where: { id: previous.id } });
    expect(old.isActive).toBe(false);
  });

  it('does not overwrite metadata of an existing same-named exercise', async () => {
    const user = await db.user.create({
      data: { email: 'template-upsert@test.dev', passwordHash: 'x' },
    });
    const existing = await db.exercise.create({
      data: {
        userId: user.id,
        name: 'Bench Press',
        muscleGroup: 'CHEST',
        category: 'COMPOUND',
        defaultRestSec: 240,
        notes: 'Pause reps, close grip',
      },
    });
    actAs(user.id);

    const res = await postFromTemplate(jsonReq(templatePayload));
    expect(res.status).toBe(201);

    const after = await db.exercise.findUniqueOrThrow({ where: { id: existing.id } });
    expect(after.defaultRestSec).toBe(240);
    expect(after.notes).toBe('Pause reps, close grip');
  });

  it('rejects unauthenticated and invalid payloads', async () => {
    actAs(null);
    const unauth = await postFromTemplate(jsonReq(templatePayload));
    expect(unauth.status).toBe(401);

    const user = await db.user.create({
      data: { email: 'template-invalid@test.dev', passwordHash: 'x' },
    });
    actAs(user.id);
    const invalid = await postFromTemplate(jsonReq({ name: 'No workouts' }));
    expect(invalid.status).toBe(400);
  });
});
