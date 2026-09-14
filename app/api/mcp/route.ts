import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { type AccessToken, bearerFrom, originOf, verify } from "@/lib/auth/tokens";
import { createSagaServer } from "@/lib/mcp/server";
import { loadFamily } from "@/lib/saga/store";

export const runtime = "nodejs";
export const maxDuration = 60;

// Self-hosted MCP server, Streamable HTTP transport (MCP spec 2025-11-25), stateless mode:
// every request is authenticated with an OAuth bearer token that identifies the family profile.

const jsonRpcError = (status: number, message: string, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: status === 403 ? -32001 : -32000, message }, id: null }), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });

async function handle(req: Request): Promise<Response> {
  const self = originOf(req);

  // Streamable HTTP: servers MUST validate Origin and answer 403 for invalid origins (DNS rebinding protection).
  const origin = req.headers.get("origin");
  const allowed = [self, ...(process.env.MCP_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean)];
  if (origin && !allowed.includes(origin)) return jsonRpcError(403, `Origin ${origin} is not allowed`);

  const token = verify<AccessToken>(bearerFrom(req), "access");
  if (!token || !token.aud.endsWith("/api/mcp")) {
    // 401 + RFC 9728 pointer for MCP clients; Alexa+ discovers auth via /.well-known/oauth-authorization-server.
    return jsonRpcError(401, "Unauthorized: link your Bedtime Saga account", {
      "www-authenticate": `Bearer resource_metadata="${self}/.well-known/oauth-protected-resource"`,
    });
  }
  const family = await loadFamily(token.sub);
  if (!family) return jsonRpcError(401, "Unknown family profile: please re-link the account");

  const server = createSagaServer(family);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // Stateless: tear down after the response is produced.
    queueMicrotask(() => void server.close().catch(() => {}));
  }
}

export { handle as GET, handle as POST, handle as DELETE };
