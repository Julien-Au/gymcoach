// CORS and allowlist policy for the MCP HTTP endpoint (issue #287).
//
// By default the endpoint keeps its historical open posture: CORS answers
// Access-Control-Allow-Origin: * and the transport does no Host/Origin
// checking (auth is bearer-token based, no cookies). Self-hosters can opt in
// to hardening by setting MCP_ALLOWED_ORIGINS and/or MCP_ALLOWED_HOSTS
// (comma-separated, exact-match values): the transport then enables DNS
// rebinding protection with those allowlists, and CORS echoes only an
// allowlisted request origin instead of *.

export interface McpCorsPolicy {
  allowedOrigins?: string[];
  allowedHosts?: string[];
}

// Parses a comma-separated allowlist env value; undefined when unset/empty.
export function parseAllowList(value: string | undefined): string[] | undefined {
  const items = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items && items.length > 0 ? items : undefined;
}

export function mcpCorsPolicyFromEnv(
  env: Record<string, string | undefined> = process.env,
): McpCorsPolicy {
  return {
    allowedOrigins: parseAllowList(env.MCP_ALLOWED_ORIGINS),
    allowedHosts: parseAllowList(env.MCP_ALLOWED_HOSTS),
  };
}

const BASE_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-GymCoach-Token, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'MCP-Protocol-Version, MCP-Session-Id',
};

// Resolves the CORS headers for a request. With no origin allowlist the
// endpoint stays wide open (*). With one, the request's Origin is echoed back
// only when allowlisted (exact match, like the SDK's DNS rebinding check);
// otherwise no Access-Control-Allow-Origin header is emitted at all.
export function corsHeadersFor(
  policy: McpCorsPolicy,
  requestOrigin: string | null,
): Record<string, string> {
  if (!policy.allowedOrigins) {
    return { ...BASE_CORS_HEADERS, 'Access-Control-Allow-Origin': '*' };
  }
  if (requestOrigin && policy.allowedOrigins.includes(requestOrigin)) {
    return {
      ...BASE_CORS_HEADERS,
      'Access-Control-Allow-Origin': requestOrigin,
      Vary: 'Origin',
    };
  }
  // Vary on the deny branch too, so a shared or preflight cache never reuses
  // a no-allow-origin response for a later allowlisted origin.
  return { ...BASE_CORS_HEADERS, Vary: 'Origin' };
}
