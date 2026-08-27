import { describe, expect, it } from 'vitest';

import { GET, OPTIONS, POST } from '@/app/mcp/route';

// Issue #316: with the stateless transport (sessionIdGenerator: undefined) a
// GET routed into the shared handler produced no response at all - the request
// hung until client timeout, so MCP clients that probe with GET before POSTing
// initialize could never connect. GET must answer 405 promptly instead.
describe('MCP route method handling', () => {
  it('answers GET with 405 and an Allow header instead of hanging', async () => {
    const res = await GET(new Request('http://test.local/mcp'));
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST, DELETE, OPTIONS');
  });

  it('answers an authenticated-looking SSE probe GET with 405 too', async () => {
    const res = await GET(
      new Request('http://test.local/mcp', {
        headers: {
          authorization: 'Bearer gmc_not_a_real_token',
          accept: 'text/event-stream',
        },
      }),
    );
    expect(res.status).toBe(405);
  });

  it('still rejects an unauthenticated POST with 401', async () => {
    const res = await POST(
      new Request('http://test.local/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('still answers OPTIONS with 204', async () => {
    const res = await OPTIONS(new Request('http://test.local/mcp', { method: 'OPTIONS' }));
    expect(res.status).toBe(204);
  });
});
