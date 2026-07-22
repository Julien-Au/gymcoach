import { authenticateMcpRequest } from '@/lib/mcp/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const principal = await authenticateMcpRequest(req);
  if (!principal) return Response.json({ status: 'unauthorized' }, { status: 401 });
  return Response.json({ status: 'ok', service: 'gymcoach-mcp', canWrite: principal.canWrite });
}
