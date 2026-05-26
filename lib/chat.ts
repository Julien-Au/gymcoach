// Derives a short, human-friendly conversation title from the first message.
export function deriveConversationTitle(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  if (cleaned === '') return 'New conversation';
  if (cleaned.length <= 60) return cleaned;
  return `${cleaned.slice(0, 57).trimEnd()}...`;
}
