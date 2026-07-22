import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateMcpRequest } from '@/lib/mcp/auth';
import { createGymCoachMcpServer } from '@/lib/mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-GymCoach-Token, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'MCP-Protocol-Version, MCP-Session-Id',
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handle(req: Request): Promise<Response> {
  const principal = await authenticateMcpRequest(req);
  if (!principal) {
    return withCors(
      Response.json(
        { jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null },
        { status: 401 },
      ),
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createGymCoachMcpServer({
    principal,
    baseUrl: new URL(req.url).origin,
  });
  await server.connect(transport);
  return withCors(await transport.handleRequest(req));
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

export async function DELETE(req: Request) {
  return handle(req);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
