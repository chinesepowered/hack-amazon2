import crypto from "node:crypto";

// Stateless OAuth 2.1 (authorization code + PKCE S256) for the demo account-linking flow.
// Codes and access tokens are HMAC-signed payloads, so no token database is needed.

const SECRET = process.env.SAGA_SIGNING_SECRET || "dev-only-signing-secret-change-me";

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64url");
}

export function sign(payload: Record<string, unknown>): string {
  const body = b64url(JSON.stringify(payload));
  const mac = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verify<T extends { exp: number }>(token: string | null | undefined, kind: string): T | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.kind !== kind || typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload as T;
  } catch {
    return null;
  }
}

export function pkceChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export type AccessToken = { kind: "access"; sub: string; aud: string; scope: string; exp: number };
export type AuthCode = {
  kind: "code";
  sub: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  resource: string;
  exp: number;
};

export function bearerFrom(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

export function originOf(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  return `${proto}://${host}`;
}

export function newId(bytes = 12) {
  return crypto.randomBytes(bytes).toString("base64url");
}
