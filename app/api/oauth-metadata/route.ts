import { originOf } from "@/lib/auth/tokens";

// Served at /.well-known/oauth-authorization-server and /.well-known/oauth-protected-resource
// (see rewrites in next.config.ts). The Alexa+ MCP Toolkit reads authorization-server metadata;
// MCP 2025-11-25 clients read RFC 9728 protected-resource metadata. We publish both.
export async function GET(req: Request) {
  const origin = originOf(req);
  const kind = new URL(req.url).searchParams.get("kind");
  const headers = { "content-type": "application/json", "access-control-allow-origin": "*" };
  if (kind === "protected-resource") {
    return new Response(
      JSON.stringify({
        resource: `${origin}/api/mcp`,
        authorization_servers: [origin],
        bearer_methods_supported: ["header"],
        scopes_supported: ["saga"],
        resource_name: "Bedtime Saga",
      }),
      { headers },
    );
  }
  return new Response(
    JSON.stringify({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["saga"],
    }),
    { headers },
  );
}
