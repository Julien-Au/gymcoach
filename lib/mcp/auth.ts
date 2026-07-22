import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';

const TOKEN_PREFIX = 'gmc_';

export interface McpPrincipal {
  tokenId: string;
  userId: string;
  canWrite: boolean;
}

export function generateMcpToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function hashMcpToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function visibleMcpTokenPrefix(token: string): string {
  return `${token.slice(0, 12)}...`;
}

export function readMcpToken(req: Request): string | null {
  const authorization = req.headers.get('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim() || null;
  }

  const headerToken = req.headers.get('x-gymcoach-token')?.trim();
  if (headerToken) return headerToken;

  return new URL(req.url).searchParams.get('token')?.trim() || null;
}

export async function authenticateMcpRequest(req: Request): Promise<McpPrincipal | null> {
  const token = readMcpToken(req);
  if (!token?.startsWith(TOKEN_PREFIX)) return null;

  const row = await db.mcpAccessToken.findUnique({
    where: { tokenHash: hashMcpToken(token) },
    select: { id: true, userId: true, canWrite: true, revokedAt: true, lastUsedAt: true },
  });
  if (!row || row.revokedAt) return null;

  const staleUsage = !row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 5 * 60_000;
  if (staleUsage) {
    void db.mcpAccessToken
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }

  return { tokenId: row.id, userId: row.userId, canWrite: row.canWrite };
}
