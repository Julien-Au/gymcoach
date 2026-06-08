import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError, handleApiError, parseJsonBody } from './api';

function jsonRequest(body: string): Request {
  return new Request('http://test.local/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

describe('handleApiError', () => {
  it('maps an ApiError to its own status and message', async () => {
    const res = handleApiError(new ApiError(401, 'Unauthorized'));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('maps a Prisma P2002 unique-constraint error to 409', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const res = handleApiError(err);
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: 'Conflict: an entry with this value already exists.',
    });
  });

  it('maps a Prisma P2025 record-not-found error to 404', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025',
      clientVersion: 'test',
    });
    const res = handleApiError(err);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not found.' });
  });

  it('maps any other error to a generic 500 without leaking details', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = handleApiError(new Error('database password is hunter2'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Server error.' });
    expect(JSON.stringify(body)).not.toContain('hunter2');
    spy.mockRestore();
  });

  it('treats an unknown Prisma code as a 500 (not 409/404)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Prisma.PrismaClientKnownRequestError('boom', {
      code: 'P2003',
      clientVersion: 'test',
    });
    const res = handleApiError(err);
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe('parseJsonBody', () => {
  const schema = z.object({ name: z.string().min(1) });

  it('returns the parsed data for a valid payload', async () => {
    const data = await parseJsonBody(jsonRequest(JSON.stringify({ name: 'ok' })), schema);
    expect(data).toEqual({ name: 'ok' });
  });

  it('throws a 400 ApiError on invalid JSON', async () => {
    await expect(parseJsonBody(jsonRequest('not json{'), schema)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('throws a 400 ApiError when the payload fails schema validation', async () => {
    await expect(
      parseJsonBody(jsonRequest(JSON.stringify({ name: '' })), schema),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      parseJsonBody(jsonRequest(JSON.stringify({ name: '' })), schema),
    ).rejects.toMatchObject({ status: 400 });
  });
});
