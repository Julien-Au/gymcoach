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
    // The write carries userId too (issue #317): the revoke stays scoped even
    // if the check above is ever removed.
    await db.mcpAccessToken.update({ where: { id, userId }, data: { revokedAt: new Date() } });
    return Response.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
