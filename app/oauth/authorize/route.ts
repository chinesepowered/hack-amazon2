import { newId, originOf, sign } from "@/lib/auth/tokens";
import { seedFamily } from "@/lib/saga/seed";
import { saveFamily } from "@/lib/saga/store";

// OAuth 2.1 authorization endpoint (authorization code + PKCE S256), the same shape the
// Alexa+ MCP Toolkit uses for account linking. The consent page creates a demo family profile.

type Params = Record<string, string>;

function validate(p: Params, origin: string): string | null {
  if (p.response_type !== "code") return "response_type must be code";
  if (p.code_challenge_method !== "S256" || !p.code_challenge) return "PKCE with S256 is required";
  if (!p.client_id) return "client_id is required";
  if (!p.redirect_uri) return "redirect_uri is required";
  const redirect = new URL(p.redirect_uri, origin);
  const allowed = redirect.origin === origin || redirect.hostname === "localhost" || redirect.hostname.endsWith(".amazon.com");
  if (!allowed) return "redirect_uri is not registered for this client";
  return null;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function page(p: Params) {
  const hidden = Object.entries(p)
    .filter(([k]) => !["family", "child"].includes(k))
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Link Bedtime Saga</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,#2c2f6e,#10142f 70%);font-family:Nunito,'Trebuchet MS',system-ui,sans-serif;color:#2b2140;padding:24px;box-sizing:border-box}
.card{background:#fff4dc;border-radius:22px;max-width:420px;width:100%;padding:30px 30px 26px;box-shadow:0 30px 80px #0008}
h1{font-family:Fraunces,Georgia,serif;margin:0 0 6px;font-size:28px}p{margin:0 0 18px;line-height:1.45;color:#5b4c6a}
label{display:block;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#7a6a8a;margin:14px 0 6px}
input[type=text]{width:100%;box-sizing:border-box;border:2px solid #e3cfa9;background:#fffaf0;border-radius:12px;padding:12px 14px;font-size:17px;font-family:inherit}
ul{padding-left:18px;color:#5b4c6a;line-height:1.6;margin:16px 0 20px}button{width:100%;border:0;border-radius:14px;padding:14px;font-size:17px;font-weight:800;background:#ffb54c;color:#2b2140;cursor:pointer;font-family:inherit}
small{display:block;margin-top:14px;color:#8a7a8a;text-align:center}</style></head><body>
<form class="card" method="post" data-testid="consent-form"><h1>Link Bedtime Saga</h1>
<p><b>Alexa+ (simulated)</b> is asking to link to your Bedtime Saga family profile.</p>
<label for="family">Family name</label><input id="family" type="text" name="family" value="The Rivera Family">
<label for="child">Child's first name</label><input id="child" type="text" name="child" value="Luna">
<ul><li>Continue your child's saga night after night</li><li>Parent guardrails stay on this profile</li><li>Your child's data never leaves the family profile</li></ul>
${hidden}<button type="submit" data-testid="consent-allow">Allow and link</button><small>OAuth 2.1 · PKCE (S256) · demo account, no sign-up</small></form></body></html>`;
}

export async function GET(req: Request) {
  const origin = originOf(req);
  const p = Object.fromEntries(new URL(req.url).searchParams) as Params;
  const err = validate(p, origin);
  if (err) return new Response(err, { status: 400 });
  return new Response(page(p), { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function POST(req: Request) {
  const origin = originOf(req);
  const form = await req.formData();
  const p = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) as Params;
  const err = validate(p, origin);
  if (err) return new Response(err, { status: 400 });

  const familyId = newId(16);
  await saveFamily(seedFamily(familyId, p.family ?? "", p.child ?? ""));

  const code = sign({
    kind: "code",
    sub: familyId,
    client_id: p.client_id,
    redirect_uri: p.redirect_uri,
    code_challenge: p.code_challenge,
    resource: p.resource ?? `${origin}/api/mcp`,
    exp: Math.floor(Date.now() / 1000) + 300,
  });
  const redirect = new URL(p.redirect_uri, origin);
  redirect.searchParams.set("code", code);
  if (p.state) redirect.searchParams.set("state", p.state);
  return Response.redirect(redirect.toString(), 302);
}
