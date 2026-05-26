import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, requireApiUserId } from '@/lib/api';
import { effectiveWeight, estimate1RM, setVolume } from '@/lib/stats';

// GET /api/history/csv?programId=...&month=YYYY-MM
// Returns a CSV (UTF-8 + BOM for Excel) with one row per non-warmup set.
// Same filters as the /history page.
export async function GET(req: Request) {
  try {
    const userId = await requireApiUserId();
    const url = new URL(req.url);
    const programId = url.searchParams.get('programId');
    const month = url.searchParams.get('month');

    const where: Record<string, unknown> = {
      userId,
      finishedAt: { not: null },
    };
    if (programId) where.programId = programId;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yStr, mStr] = month.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      where.startedAt = {
        gte: new Date(Date.UTC(y, m - 1, 1)),
        lt: new Date(Date.UTC(y, m, 1)),
      };
    }

    const [sessions, user] = await Promise.all([
      db.session.findMany({
        where,
        orderBy: { startedAt: 'asc' },
        include: {
          program: { select: { name: true } },
          workout: { select: { name: true } },
          sets: {
            orderBy: [{ exerciseId: 'asc' }, { setNumber: 'asc' }],
            include: {
              exercise: {
                select: { name: true, muscleGroup: true, usesBodyweight: true },
              },
            },
          },
        },
      }),
      db.user.findUnique({
        where: { id: userId },
        select: { bodyweight: true },
      }),
    ]);
    const bodyweight = user?.bodyweight ?? null;

    const HEADERS = [
      'session_id',
      'session_date',
      'session_started_at',
      'session_finished_at',
      'duration_min',
      'program',
      'workout',
      'exercise',
      'muscle_group',
      'uses_bodyweight',
      'set_number',
      'external_load_kg', // entered value (added weight for bodyweight exercises, total load otherwise)
      'effective_weight_kg', // = bodyweight + external for bodyweight exercises, otherwise = external
      'reps',
      'rir',
      'is_warmup',
      'is_drop_set',
      'volume_kg', // based on effective weight
      'estimated_1rm_kg', // based on effective weight
      'set_notes',
    ];

    const lines: string[] = [HEADERS.join(',')];

    for (const s of sessions) {
      const durationMin =
        s.finishedAt && s.startedAt
          ? Math.round((s.finishedAt.getTime() - s.startedAt.getTime()) / 60000)
          : '';
      const dateOnly = s.startedAt.toISOString().slice(0, 10);
      for (const set of s.sets) {
        const eff = effectiveWeight(
          set.weight,
          set.exercise.usesBodyweight,
          bodyweight,
        );
        const effSet = { weight: eff, reps: set.reps, isWarmup: set.isWarmup };
        const row = [
          s.id,
          dateOnly,
          s.startedAt.toISOString(),
          s.finishedAt?.toISOString() ?? '',
          String(durationMin),
          s.program?.name ?? '',
          s.workout?.name ?? '',
          set.exercise.name,
          set.exercise.muscleGroup,
          set.exercise.usesBodyweight ? 'true' : 'false',
          String(set.setNumber),
          String(set.weight),
          String(eff),
          String(set.reps),
          set.rir != null ? String(set.rir) : '',
          set.isWarmup ? 'true' : 'false',
          set.isDropSet ? 'true' : 'false',
          String(setVolume(effSet)),
          set.isWarmup ? '' : estimate1RM(eff, set.reps).toFixed(2),
          set.notes ?? '',
        ];
        lines.push(row.map(csvEscape).join(','));
      }
    }

    // UTF-8 BOM so Excel detects the encoding and displays accents correctly.
    const body = '﻿' + lines.join('\n');
    const filename = buildFilename(month, programId);
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// RFC 4180 escaping: double quotes + internal escape, on any field
// containing , " \n or \r.
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildFilename(month: string | null, programId: string | null): string {
  const parts = ['gymcoach-history'];
  if (month) parts.push(month);
  if (programId) parts.push(`prog-${programId.slice(0, 8)}`);
  if (parts.length === 1) parts.push(new Date().toISOString().slice(0, 10));
  return parts.join('-') + '.csv';
}
