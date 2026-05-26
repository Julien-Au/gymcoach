import { MessageSquare } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { getLlmProvider } from '@/lib/llm';
import {
  ChatClient,
  type ChatMessage,
  type ConversationSummary,
} from '@/components/coach/chat-client';

export default async function ChatPage() {
  const auth = await requireSession();

  const conversations = await db.conversation.findMany({
    where: { userId: auth.userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: { id: true, title: true, updatedAt: true },
  });

  const active = conversations[0] ?? null;
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
          hasApiKey={provider.isConfigured()}
          providerLabel={provider.label}
          apiKeyEnvVar={provider.apiKeyEnvVar}
        />
      </div>
    </main>
  );
}
