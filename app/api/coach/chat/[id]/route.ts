import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';

// Ownership is enforced by scoping every query with the owning user (issue
// #317): the message read is constrained through the conversation relation,
// and the delete carries userId in its own where, so neither survives the
// removal of the other.

// GET /api/coach/chat/[id]: messages of a conversation (owner only).
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const conv = await db.conversation.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    });
    if (!conv) throw new ApiError(404, 'Conversation not found.');
    const messages = await db.message.findMany({
      where: { conversationId: params.id, conversation: { userId } },
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
    await db.conversation.delete({ where: { id: params.id, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
