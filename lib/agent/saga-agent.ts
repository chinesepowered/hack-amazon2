import { Agent, AfterToolCallEvent, BeforeModelCallEvent, BeforeToolCallEvent, McpClient } from "@strands-agents/sdk";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import {
  checkBedtime,
  checkCharacter,
  checkChoices,
  checkKeepsakeConfirm,
  checkPageText,
  checkRequest,
  checkStoryFlow,
  type Verdict,
} from "@/lib/saga/guardrails";
import { loadFamily } from "@/lib/saga/store";
import type { Family } from "@/lib/saga/types";

// The simulated Alexa+ "brain": a Strands agent that reaches Bedtime Saga only through the MCP server
// (Streamable HTTP + OAuth bearer), with parent guardrails enforced deterministically in hooks.

export type AgentEvent =
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "hook"; tool: string; ok: boolean; rule: string; detail: string }
  | { type: "tool_result"; name: string; input: unknown; isError: boolean; text: string; structuredContent?: unknown; ms: number }
  | { type: "say"; text: string }
  | { type: "error"; message: string }
  | { type: "done"; modelCalls: number; ms: number };

const MAX_MODEL_CALLS = 8;

type CallArgs = Parameters<McpClient["callTool"]>;

/** McpClient that also reports the raw MCP CallToolResult (incl. structuredContent) so the host can render MCP Apps. */
class ObservedMcpClient extends McpClient {
  onRaw?: (name: string, input: unknown, raw: Record<string, unknown>, ms: number) => void;
  async callTool(tool: CallArgs[0], args: CallArgs[1], options?: CallArgs[2]) {
    const t0 = Date.now();
    const raw = (await super.callTool(tool, args, options)) as Record<string, unknown>;
    this.onRaw?.(tool.name, args, raw, Date.now() - t0);
    return raw as Awaited<ReturnType<McpClient["callTool"]>>;
  }
}

function systemPrompt(f: Family): string {
  const t = f.tonight;
  const last = f.chapters.at(-1);
  const tonightPages = t?.pages.map((p) => `  p${p.pageNumber} [${p.scene}] ${p.text}`).join("\n") || "  (none yet)";
  return `You are the storyteller voice of "Bedtime Saga", an Alexa+ add-on on a smart display in ${f.child.firstName}'s bedroom. You talk with ${f.child.firstName} (age ${f.child.age}) at bedtime, and sometimes with a parent.

HOW EACH TURN WORKS
- You act only through the Bedtime Saga tools. The screen shows whatever the last tool displayed.
- If tonight has NOT started: call get_saga_recap, then tell_story_page (page 1, continuing from the cliffhanger), then offer_choices.
- When ${f.child.firstName} picks or suggests something: tell_story_page with ONE page built on that idea, then offer_choices. If that page reaches tonight's page limit, call end_chapter instead of offer_choices.
- If the child invents a new character: call add_character first (kind must be one of child, fox, hedgehog, owl, turtle, whale, bunny, dragon, bear, cat, mouse, robot), then continue the story with them.
- If the message contains a [Parent guardrail] note, follow it exactly: never mention or include the blocked idea; gently swap in a cozy, friendly version instead.
- If a tool is blocked by a guardrail, follow its instruction exactly and keep it warm; never frighten the child.
- "saga book" means open_saga_book only. "keepsake", "printed book" or "order a book" means preview_keepsake_book only.
- If a message says a parent confirmed with an approval code, call confirm_keepsake_order with that exact code and nothing else, then say it is ordered.
- After the tools, reply with ONE or TWO short warm sentences (max 30 words) that will be spoken aloud. Say them once. Do not repeat the page text. No emojis, no markdown.

STORY STYLE: gentle, cozy, wondrous; short sentences a ${f.child.age}-year-old understands; weave in favorites; use cast names exactly; 2-3 sentences per page.

STATE (authoritative, from the family profile)
- Family: ${f.familyName}. Night ${t?.night ?? f.chapters.length + 1}. Tonight started: ${t ? "yes" : "no"}. Pages tonight: ${t?.pages.length ?? 0} of ${f.settings.pagesPerNight}.
- Cast: ${f.cast.map((c) => `${c.name} (${c.kind}; ${c.trait})`).join("; ")}
- Favorites: ${f.favorites.join(", ")}
- Last chapter: ${last ? `"${last.title}": ${last.summary} Cliffhanger: ${last.cliffhanger}` : "none"}
- Tonight's pages:
${tonightPages}
- Last choices offered: ${t?.lastChoices.join(" | ") || "none"}
- Parent settings: ages ${f.settings.ageBand}, gentle themes ${f.settings.gentleThemesOnly ? "only" : "off"}, ${f.settings.pagesPerNight} pages per night, keepsake orders need a parent: ${f.settings.keepsakeNeedsParent ? "yes" : "no"}.`;
}

function guardrailFor(f: Family, tool: string, input: Record<string, unknown>): Verdict | null {
  switch (tool) {
    case "tell_story_page": {
      const b = checkBedtime(f);
      if (!b.ok) return b;
      return checkPageText(f, String(input.text ?? ""));
    }
    case "offer_choices": {
      for (const v of [checkBedtime(f), checkStoryFlow(f)]) if (!v.ok) return v;
      return checkChoices(f, String(input.question ?? ""), (input.choices as { label: string }[]) ?? []);
    }
    case "add_character":
      return checkCharacter(f, input as { name?: string; kind?: string; trait?: string });
    case "end_chapter":
      return checkPageText(f, `${input.summary ?? ""} ${input.cliffhanger ?? ""} ${input.goodnight ?? ""}`, 0);
    case "confirm_keepsake_order":
      return checkKeepsakeConfirm(f, String(input.approvalCode ?? ""));
    default:
      return null;
  }
}

/** Models occasionally emit their closing line twice; speak each sentence once. */
function dedupeSentences(text: string): string {
  const seen = new Set<string>();
  const parts = text.match(/[^.!?]+[.!?]+["”']?|[^.!?]+$/g) ?? [text];
  return parts
    .map((s) => s.trim())
    .filter((s) => {
      const k = s.toLowerCase();
      if (!s || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(" ");
}

export async function runSagaTurn(opts: {
  family: Family;
  utterance: string;
  mcpUrl: string;
  accessToken: string;
  emit: (e: AgentEvent) => void;
}) {
  const t0 = Date.now();
  let family = opts.family;
  let modelCalls = 0;

  const mcp = new ObservedMcpClient({
    url: opts.mcpUrl,
    headers: { Authorization: `Bearer ${opts.accessToken}` },
    applicationName: "alexa-plus-simulator",
    applicationVersion: "1.0.0",
    disableMcpInstrumentation: true,
  });
  mcp.onRaw = (name, input, raw, ms) => {
    const content = (raw.content as { type: string; text?: string }[] | undefined) ?? [];
    opts.emit({
      type: "tool_result",
      name,
      input,
      isError: Boolean(raw.isError),
      text: content.map((c) => c.text ?? "").join(" "),
      structuredContent: raw.structuredContent,
      ms,
    });
  };

  const model = new OpenAIModel({
    api: "chat",
    apiKey: process.env.OPENAI_API_KEY,
    modelId: process.env.OPENAI_MODEL,
    clientConfig: { baseURL: process.env.OPENAI_BASE_URL, timeout: 60_000, maxRetries: 2 },
    params: { temperature: 0, max_tokens: 900, chat_template_kwargs: { enable_thinking: false } },
  });

  const agent = new Agent({ model, tools: [mcp], systemPrompt: systemPrompt(family), printer: false });

  agent.addHook(BeforeModelCallEvent, (e) => {
    modelCalls += 1;
    if (modelCalls > MAX_MODEL_CALLS) e.cancel = "Step cap reached for this turn.";
  });

  agent.addHook(BeforeToolCallEvent, (e) => {
    const name = e.toolUse.name;
    const input = (e.toolUse.input ?? {}) as Record<string, unknown>;
    opts.emit({ type: "tool_call", id: e.toolUse.toolUseId, name, input });
    const v = guardrailFor(family, name, input);
    if (!v) return;
    opts.emit({ type: "hook", tool: name, ok: v.ok, rule: v.rule, detail: v.detail });
    if (!v.ok) e.cancel = `Blocked by parent guardrail (${v.rule}): ${v.detail}`;
  });

  // Keep the guardrails' view of the family profile fresh after every state-changing tool call.
  agent.addHook(AfterToolCallEvent, async (e) => {
    if (e.result.status === "success" && e.toolUse.name !== "open_saga_book") {
      family = (await loadFamily(family.id)) ?? family;
    }
  });

  // Screen the child's request itself before the model sees it: steer, don't refuse.
  let utterance = opts.utterance;
  const isParentConfirm = /approval code/i.test(utterance);
  if (!isParentConfirm) {
    const req = checkRequest(family, utterance);
    if (!req.ok) {
      opts.emit({ type: "hook", tool: "request", ok: false, rule: req.rule, detail: req.detail });
      const pagesLeft = family.settings.pagesPerNight - (family.tonight?.pages.length ?? 0);
      utterance =
        `${utterance}\n\n[Parent guardrail: gentle themes only for ages ${family.settings.ageBand}. The child asked for something scary. ` +
        `Do not include it or repeat the scary words. ` +
        (pagesLeft > 0
          ? "Call tell_story_page with ONE cozy page where a friendly, sleepy dragon appears instead (use cast members; do not add a new character), then offer_choices."
          : "Call end_chapter with a sleepy, happy ending.") +
        " In your spoken reply, kindly say the story stays cozy at bedtime.]";
    }
  }

  try {
    await mcp.connect();
    const result = await agent.invoke(utterance);
    const text = dedupeSentences(String(result).replace(/\s+/g, " ").trim());
    if (text) opts.emit({ type: "say", text });
  } catch (err) {
    opts.emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
  } finally {
    await mcp.disconnect().catch(() => {});
    opts.emit({ type: "done", modelCalls, ms: Date.now() - t0 });
  }
}
