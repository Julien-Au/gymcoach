import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';
import { generateMcpToken, hashMcpToken, visibleMcpTokenPrefix } from '@/lib/mcp/auth';

const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  canWrite: z.boolean().default(false),
});

export async function GET() {
  try {
    const userId = await requireApiUserId();
    const tokens = await db.mcpAccessToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        canWrite: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
    return Response.json(tokens);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const activeCount = await db.mcpAccessToken.count({ where: { userId, revokedAt: null } });
    if (activeCount >= 10) throw new ApiError(400, 'Revoke an old MCP token first.');

    const input = await parseJsonBody(req, createTokenSchema);
    const token = generateMcpToken();
    const created = await db.mcpAccessToken.create({
      data: {
        userId,
        name: input.name,
        canWrite: input.canWrite,
        tokenHash: hashMcpToken(token),
        tokenPrefix: visibleMcpTokenPrefix(token),
      },
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        canWrite: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    const configuredBase = process.env.MCP_PUBLIC_URL?.trim().replace(/\/+$/, '');
    const baseUrl = configuredBase || new URL(req.url).origin;
    const connectorUrl = `${baseUrl}/mcp?token=${encodeURIComponent(token)}`;

    return Response.json({ token: created, connectorUrl }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
