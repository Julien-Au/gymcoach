import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';

async function ensureOwnership(id: string, userId: string) {
  const conv = await db.conversation.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!conv || conv.userId !== userId) {
    throw new ApiError(404, 'Conversation not found.');
  }
}

// GET /api/coach/chat/[id]: messages of a conversation (owner only).
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    await ensureOwnership(params.id, userId);
    const messages = await db.message.findMany({
      where: { conversationId: params.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });
    return NextResponse.json({ messages });
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/coach/chat/[id]: deletes a conversation and its messages.
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    await ensureOwnership(params.id, userId);
    await db.conversation.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
