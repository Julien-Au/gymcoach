import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateMcpRequest } from '@/lib/mcp/auth';
import { corsHeadersFor, mcpCorsPolicyFromEnv } from '@/lib/mcp/cors';
import { createGymCoachMcpServer } from '@/lib/mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function withCors(req: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  const cors = corsHeadersFor(mcpCorsPolicyFromEnv(), req.headers.get('origin'));
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
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
      req,
      Response.json(
        { jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null },
        { status: 401 },
      ),
    );
  }

  // With an allowlist configured the transport rejects requests whose Host or
  // Origin header is not allowlisted (DNS rebinding protection); unset keeps
  // the historical open behavior for existing deployments (issue #287).
  const { allowedOrigins, allowedHosts } = mcpCorsPolicyFromEnv();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    ...(allowedOrigins || allowedHosts
      ? {
          enableDnsRebindingProtection: true,
          ...(allowedHosts ? { allowedHosts } : {}),
          ...(allowedOrigins ? { allowedOrigins } : {}),
        }
      : {}),
  });
  const server = createGymCoachMcpServer({
    principal,
    baseUrl: new URL(req.url).origin,
  });
  await server.connect(transport);
  return withCors(req, await transport.handleRequest(req));
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  // The transport is stateless (sessionIdGenerator: undefined), so there is no
  // session to attach an SSE stream to and a GET routed into handle() would
  // hang with no response at all (issue #316). The Streamable HTTP spec says a
  // server that offers no SSE stream on GET responds 405 so clients fall back
  // to POST. If session support is ever added, this must become conditional on
  // whether a session id generator is configured.
  return withCors(
    req,
    new Response(null, { status: 405, headers: { Allow: 'POST, DELETE, OPTIONS' } }),
  );
}

export async function DELETE(req: Request) {
  return handle(req);
}

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeadersFor(mcpCorsPolicyFromEnv(), req.headers.get('origin')),
  });
}
