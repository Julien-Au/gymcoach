import { MessageSquare } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getLlmProvider } from '@/lib/llm';
import {
  ChatClient,
  type ChatMessage,
  type ConversationSummary,
} from '@/components/coach/chat-client';

interface SearchParams {
  sessionId?: string;
}

export default async function ChatPage(
  props: {
    searchParams: Promise<SearchParams>;
  }
) {
  const searchParams = await props.searchParams;
  const auth = await requireSession();

  // In-session chat (issue #111): the session runner links here with
  // ?sessionId=... . Only forward an id that belongs to the caller; anything
  // else degrades to a normal chat (the API re-checks ownership anyway).
  let sessionId: string | null = null;
  if (searchParams.sessionId) {
    const owned = await db.session.findFirst({
      where: { id: searchParams.sessionId, userId: auth.userId },
      select: { id: true },
    });
    sessionId = owned?.id ?? null;
  }

  const conversations = await db.conversation.findMany({
    where: { userId: auth.userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: { id: true, title: true, updatedAt: true },
  });

  // With a live session attached, start on a fresh conversation so the
  // mid-workout question is not appended to an old thread.
  const active = sessionId ? null : (conversations[0] ?? null);
  let initialMessages: ChatMessage[] = [];
  if (active) {
    const msgs = await db.message.findMany({
      where: { conversationId: active.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });
    initialMessages = msgs.map((m) => ({
      role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
      content: m.content,
    }));
  }

  const initialConversations: ConversationSummary[] = conversations.map((c) => ({
    id: c.id,
    title: c.title ?? 'Conversation',
    updatedAt: c.updatedAt.toISOString(),
  }));

  const provider = getLlmProvider();

  return (
    <main className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="size-6" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
            <p className="text-xs text-muted-foreground">
              Talk to your coach with your training data in context.
            </p>
          </div>
        </div>

        <ChatClient
          initialConversations={initialConversations}
          initialActiveId={active?.id ?? null}
          initialMessages={initialMessages}
          sessionId={sessionId}
          hasApiKey={provider.isConfigured()}
          providerLabel={provider.label}
          apiKeyEnvVar={provider.apiKeyEnvVar}
        />
      </div>
    </main>
  );
}
