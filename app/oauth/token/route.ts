import { type AuthCode, originOf, pkceChallenge, sign, verify } from "@/lib/auth/tokens";

// OAuth 2.1 token endpoint: exchanges a signed authorization code + PKCE verifier for a bearer token.
export async function POST(req: Request) {
  const origin = originOf(req);
  const ct = req.headers.get("content-type") ?? "";
  const p: Record<string, string> = ct.includes("application/json")
    ? await req.json()
    : Object.fromEntries([...(await req.formData()).entries()].map(([k, v]) => [k, String(v)]));

  const fail = (error: string, description: string) =>
    new Response(JSON.stringify({ error, error_description: description }), { status: 400, headers: { "content-type": "application/json" } });

  if (p.grant_type !== "authorization_code") return fail("unsupported_grant_type", "only authorization_code is supported");
  const code = verify<AuthCode>(p.code, "code");
  if (!code) return fail("invalid_grant", "code is invalid or expired");
  if (code.client_id !== p.client_id || code.redirect_uri !== p.redirect_uri) return fail("invalid_grant", "client_id or redirect_uri mismatch");
  if (!p.code_verifier || pkceChallenge(p.code_verifier) !== code.code_challenge) return fail("invalid_grant", "PKCE verification failed");

  const expiresIn = 30 * 24 * 3600;
  const accessToken = sign({
    kind: "access",
    sub: code.sub,
    aud: code.resource || `${origin}/api/mcp`,
    scope: "saga",
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  });
  return new Response(JSON.stringify({ access_token: accessToken, token_type: "Bearer", expires_in: expiresIn, scope: "saga" }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
