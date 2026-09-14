import type { CharacterKind } from "@/lib/art/catalog";
import type { Family } from "./types";

// Deterministic parent guardrails. The same functions run in the Strands hooks (before a tool
// ever reaches the MCP server) and again inside the MCP server (defense in depth).

export type Verdict = { ok: true; rule: string; detail: string } | { ok: false; rule: string; detail: string };

const pass = (rule: string, detail: string): Verdict => ({ ok: true, rule, detail });
const block = (rule: string, detail: string): Verdict => ({ ok: false, rule, detail });

const SCARY_KINDS = /\b(monster|zombie|ghost|witch|vampire|werewolf|skeleton|demon|shark|spider|troll|goblin|clown)s?\b/i;

const ALLOWED_KINDS: Record<Family["settings"]["ageBand"], CharacterKind[]> = {
  "3-5": ["child", "fox", "hedgehog", "owl", "turtle", "whale", "bunny", "dragon", "bear", "cat", "mouse", "robot"],
  "6-8": ["child", "fox", "hedgehog", "owl", "turtle", "whale", "bunny", "dragon", "bear", "cat", "mouse", "robot"],
};

// Stems, so "scared", "scary", "attacked" all match.
const HARSH_THEMES = [
  "monster", "zombie", "ghost", "blood", "kill", "dead", "death", "die ", "dying", "weapon", "gun", "knife", "sword",
  "attack", "fight", "hurt", "scream", "nightmare", "scar", "terrif", "horror", "evil", "devour", "eat everyone",
  "eats everyone", "lost forever", "alone forever", "punish",
];

const PII = [/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, /[\w.+-]+@[\w-]+\.[\w.]+/, /\b\d{2,5}\s+\w+\s+(street|st|avenue|ave|road|rd|lane|ln|drive|dr)\b/i];

export function harshWord(text: string): string | undefined {
  const lower = ` ${text.toLowerCase()} `;
  return HARSH_THEMES.find((w) => lower.includes(w))?.trim();
}

/** Screens what the child asked for before the agent runs, so the story is steered, not refused. */
export function checkRequest(family: Family, utterance: string): Verdict {
  if (!family.settings.gentleThemesOnly) return pass("gentle-request", "gentle themes not enforced");
  const hit = harshWord(utterance) ?? utterance.match(SCARY_KINDS)?.[0]?.toLowerCase();
  if (hit) {
    return block(
      "gentle-request",
      `Asked for "${hit}". Steering to a friendly alternative for ages ${family.settings.ageBand}.`,
    );
  }
  return pass("gentle-request", "request is bedtime-friendly");
}

export function checkCharacter(family: Family, input: { name?: string; kind?: string; trait?: string }): Verdict {
  const kind = String(input.kind ?? "").toLowerCase();
  const all = `${input.name ?? ""} ${kind} ${input.trait ?? ""}`;
  if (family.settings.gentleThemesOnly && (SCARY_KINDS.test(all) || harshWord(all))) {
    return block(
      "gentle-cast",
      `"${input.kind}" isn't allowed for ages ${family.settings.ageBand} (gentle themes only). Offer a friendly alternative from the catalog instead, like a sleepy dragon or a kind bear, and keep it cozy.`,
    );
  }
  if (!ALLOWED_KINDS[family.settings.ageBand].includes(kind as CharacterKind)) {
    return block("catalog", `kind must be one of: ${ALLOWED_KINDS[family.settings.ageBand].join(", ")}.`);
  }
  if (family.cast.some((c) => c.name.toLowerCase() === String(input.name ?? "").toLowerCase())) {
    return block("unique-name", `${input.name} is already in the saga. Pick a new name or just use the existing character.`);
  }
  return pass("gentle-cast", `${input.name} the ${kind} fits ages ${family.settings.ageBand}`);
}

/** Theme + privacy screen. `maxLen` applies to single story pages only (0 disables it). */
export function checkPageText(family: Family, text: string, maxLen = 420): Verdict {
  if (family.settings.gentleThemesOnly) {
    const hit = harshWord(text);
    if (hit) return block("gentle-themes", `Contains "${hit}". Rewrite it gently: no monsters, scary, violent or sad-forever themes at bedtime. A friendly dragon or a kind bear works well instead.`);
  }
  if (PII.some((re) => re.test(text))) return block("privacy", "Contains contact or address details. Child data never leaves the family profile.");
  if (maxLen > 0 && text.length > maxLen) return block("page-length", `Keep each page under ${maxLen} characters (about 3 short sentences).`);
  return pass("gentle-themes", "gentle, age-appropriate");
}

export function checkBedtime(family: Family): Verdict {
  const done = family.tonight?.pages.length ?? 0;
  const limit = family.settings.pagesPerNight;
  if (done >= limit) {
    return block("bedtime-limit", `Bedtime limit reached (${done}/${limit} pages tonight). Wind down now: call end_chapter with a sleepy, happy ending and a gentle cliffhanger for tomorrow.`);
  }
  return pass("bedtime-limit", `page ${done + 1} of ${limit} tonight`);
}

/** Every set of choices must follow a newly told page, so the story always moves forward. */
export function checkStoryFlow(family: Family): Verdict {
  const t = family.tonight;
  const pages = t?.pages.length ?? 0;
  if (pages === 0) return block("story-flow", "Tell tonight's first page with tell_story_page before offering choices.");
  if (t?.choicesAtPage === pages) {
    return block("story-flow", "Choices were already offered for this page. Tell the next page with tell_story_page first (build on what the child just said), then offer new choices.");
  }
  return pass("story-flow", `choices follow page ${pages}`);
}

export function checkChoices(family: Family, question: string, choices: { label: string }[]): Verdict {
  return checkPageText(family, `${question} ${choices.map((c) => c.label).join(" ")}`, 0);
}

export function checkKeepsakeConfirm(family: Family, approvalCode: string | undefined): Verdict {
  const pending = family.orders.find((o) => o.status === "pending_parent");
  if (!pending) return block("parent-approval", "No keepsake order is waiting. Call preview_keepsake_book first.");
  if (!family.settings.keepsakeNeedsParent) return pass("parent-approval", "parent approval not required by settings");
  if (!approvalCode || approvalCode !== pending.approvalCode) {
    return block("parent-approval", "Purchases need a parent. Only the parent's tap on the order card can confirm (approval code missing or wrong).");
  }
  return pass("parent-approval", "parent tapped Confirm on the order card");
}
