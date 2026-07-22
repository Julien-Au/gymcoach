import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, props: Params) {
  try {
    const userId = await requireApiUserId();
    const { id } = await props.params;
    const token = await db.mcpAccessToken.findFirst({ where: { id, userId, revokedAt: null } });
    if (!token) throw new ApiError(404, 'MCP token not found.');
    await db.mcpAccessToken.update({ where: { id }, data: { revokedAt: new Date() } });
    return Response.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
