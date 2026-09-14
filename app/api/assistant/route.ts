import { runSagaTurn, type AgentEvent } from "@/lib/agent/saga-agent";
import { type AccessToken, bearerFrom, originOf, verify } from "@/lib/auth/tokens";
import { rateLimited } from "@/lib/ratelimit";
import { loadFamily } from "@/lib/saga/store";

export const runtime = "nodejs";
export const maxDuration = 120;

// The simulated Alexa+ assistant turn: streams NDJSON events (tool calls, guardrail verdicts,
// raw MCP results for MCP Apps, spoken reply) back to the smart-display client.
export async function POST(req: Request) {
  if (rateLimited(req, "assistant", 20, 10 * 60_000)) {
    return Response.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }
  const accessToken = bearerFrom(req);
  const token = verify<AccessToken>(accessToken, "access");
  if (!token || !accessToken) return Response.json({ error: "Link your Bedtime Saga account first." }, { status: 401 });
  const family = await loadFamily(token.sub);
  if (!family) return Response.json({ error: "Family profile not found. Please re-link." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { utterance?: string };
  const utterance = String(body.utterance ?? "").trim().slice(0, 400);
  if (!utterance) return Response.json({ error: "Say something first." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      await runSagaTurn({ family, utterance, mcpUrl: `${originOf(req)}/api/mcp`, accessToken, emit });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
