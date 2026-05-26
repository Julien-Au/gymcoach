import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { getLlmProvider, LlmError } from '@/lib/llm';
import { buildCoachPayload } from '@/lib/coach';
import { CHAT_SYSTEM_PROMPT } from '@/lib/prompts/chat-system-prompt';
import { deriveConversationTitle } from '@/lib/chat';

const bodySchema = z.object({
  conversationId: z.string().cuid().optional(),
  message: z.string().trim().min(1).max(4000),
});

// POST /api/coach/chat: appends a user message and streams the assistant reply
// (text/plain chunks). The conversation id is returned in the X-Conversation-Id
// header. The assistant message is persisted once the stream completes.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();

    const rl = rateLimit(`chat:${userId}`, 30, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many messages. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      );
    }

    const { conversationId: existingId, message } = await parseJsonBody(req, bodySchema);

    let conversationId: string;
    if (existingId) {
      const conv = await db.conversation.findUnique({
        where: { id: existingId },
        select: { userId: true },
      });
      if (!conv || conv.userId !== userId) {
        throw new ApiError(404, 'Conversation not found.');
      }
      conversationId = existingId;
    } else {
      const conv = await db.conversation.create({
        data: { userId, title: deriveConversationTitle(message) },
      });
      conversationId = conv.id;
    }

    await db.message.create({
      data: { conversationId, role: 'USER', content: message },
    });

    const history = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });
    const llmMessages = history.map((m) => ({
      role: m.role === 'ASSISTANT' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    }));

    const payload = await buildCoachPayload(userId);
    const system = `${CHAT_SYSTEM_PROMPT}\n\n# Trainee's current training data (JSON)\n${JSON.stringify(payload, null, 2)}`;

    const provider = getLlmProvider();
    const encoder = new TextEncoder();
    let assistant = '';

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of provider.stream({
            system,
            messages: llmMessages,
            maxTokens: 4096,
            temperature: 0.5,
          })) {
            assistant += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          const msg =
            err instanceof LlmError ? err.message : 'The coach is unavailable right now.';
          controller.enqueue(encoder.encode(`\n\n[error] ${msg}`));
        } finally {
          if (assistant.trim()) {
            await db.message
              .create({ data: { conversationId, role: 'ASSISTANT', content: assistant } })
              .catch(() => {});
            await db.conversation
              .update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
              .catch(() => {});
          }
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Conversation-Id': conversationId,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
