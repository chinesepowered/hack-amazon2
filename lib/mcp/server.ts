import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { MOODS, PROPS, SCENES, TIMES, SCENE_LABELS } from "@/lib/art/catalog";
import { illustrate, type CastRef } from "@/lib/art/illustrate";
import { checkBedtime, checkCharacter, checkChoices, checkKeepsakeConfirm, checkPageText, checkStoryFlow } from "@/lib/saga/guardrails";
import { saveFamily } from "@/lib/saga/store";
import type { Family, StoryPage } from "@/lib/saga/types";
import { newId } from "@/lib/auth/tokens";
import { storybookHtml } from "./storybook-html";

export const STORYBOOK_URI = "ui://bedtime-saga/storybook.html";
const ui = { ui: { resourceUri: STORYBOOK_URI } };

type Result = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

const ok = (text: string, structured: Record<string, unknown>): Result => ({
  content: [{ type: "text", text }],
  structuredContent: structured,
});
const err = (text: string): Result => ({ content: [{ type: "text", text }], isError: true });

function castRefs(family: Family, names: string[]): CastRef[] {
  return names
    .map((n) => family.cast.find((c) => c.name.toLowerCase() === n.toLowerCase()))
    .filter((c): c is Family["cast"][number] => Boolean(c))
    .map((c) => ({ name: c.name, kind: c.kind }));
}

function pageSvg(family: Family, p: StoryPage) {
  return illustrate({
    scene: p.scene,
    timeOfDay: p.timeOfDay,
    cast: castRefs(family, p.characters),
    props: p.props,
    mood: p.mood,
    seed: `${family.id}|${p.night}|${p.pageNumber}`,
  });
}

function ensureTonight(family: Family) {
  if (!family.tonight) {
    family.tonight = { night: family.chapters.length + 1, startedAt: new Date().toISOString(), pages: [], lastChoices: [] };
  }
  return family.tonight;
}

function lastPage(family: Family): StoryPage | undefined {
  return family.tonight?.pages.at(-1) ?? family.chapters.at(-1)?.pages.at(-1);
}

const castLine = (family: Family) => family.cast.map((c) => `${c.name} (${c.kind}: ${c.trait})`).join("; ");

/** One MCP server instance per request, bound to the family resolved from the OAuth bearer token. */
export function createSagaServer(family: Family) {
  const server = new McpServer(
    { name: "bedtime-saga", title: "Bedtime Saga", version: "1.0.0" },
    {
      instructions:
        "Bedtime Saga continues a child's bedtime story night after night. Start every night with get_saga_recap. Tell one short page at a time with tell_story_page, then offer_choices so the child decides what happens next. Respect guardrail errors: rewrite gently, wind down with end_chapter when bedtime is reached.",
    },
  );
  const s = server as unknown as Parameters<typeof registerAppTool>[0];

  registerAppResource(
    server as unknown as Parameters<typeof registerAppResource>[0],
    "Bedtime Saga storybook",
    STORYBOOK_URI,
    {
      description: "Interactive storybook card: recap, illustrated pages, choices, saga book and keepsake checkout.",
      _meta: { ui: { csp: { resourceDomains: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] }, prefersBorder: false } },
    } as Parameters<typeof registerAppResource>[3],
    async () => ({
      contents: [
        {
          uri: STORYBOOK_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: storybookHtml(),
          _meta: { ui: { csp: { resourceDomains: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] } } },
        },
      ],
    }),
  );

  registerAppTool(
    s,
    "get_saga_recap",
    {
      title: "Recap the saga",
      description: "Start tonight's session: returns the child's saga so far (cast, favorites, last chapter and its cliffhanger) and shows a 'Last time on your saga' card.",
      inputSchema: {},
      _meta: ui,
    },
    async () => {
      const t = ensureTonight(family);
      await saveFamily(family);
      const last = family.chapters.at(-1);
      const lp = last?.pages.at(-1);
      return ok(
        `Night ${t.night} for ${family.child.firstName} (age ${family.child.age}). Cast: ${castLine(family)}. Favorites: ${family.favorites.join(", ")}. ` +
          (last ? `Last chapter "${last.title}": ${last.summary} Cliffhanger: ${last.cliffhanger}` : "This is the very first night.") +
          ` Tonight allows ${family.settings.pagesPerNight} pages; ${t.pages.length} told so far.`,
        {
          view: "recap",
          night: t.night,
          child: family.child.firstName,
          familyName: family.familyName,
          cast: family.cast,
          favorites: family.favorites,
          lastChapter: last ? { title: last.title, summary: last.summary, cliffhanger: last.cliffhanger, night: last.night } : null,
          svg: lp ? pageSvg(family, lp) : null,
          settings: family.settings,
          subscription: family.subscription,
        },
      );
    },
  );

  registerAppTool(
    s,
    "tell_story_page",
    {
      title: "Tell a story page",
      description:
        "Tell ONE short page of tonight's story (2-3 gentle sentences). Pick the scene, which cast members appear (by exact name), up to 2 props, time of day and mood; the page is illustrated automatically.",
      inputSchema: {
        text: z.string().min(20).max(420).describe("The page text read aloud, 2-3 short sentences."),
        scene: z.enum(SCENES),
        characters: z.array(z.string()).min(1).max(3).describe("Exact names of cast members on this page."),
        props: z.array(z.enum(PROPS)).max(2).default([]),
        timeOfDay: z.enum(TIMES),
        mood: z.enum(MOODS),
      },
      _meta: ui,
    },
    async (args: { text: string; scene: (typeof SCENES)[number]; characters: string[]; props?: (typeof PROPS)[number][]; timeOfDay: (typeof TIMES)[number]; mood: (typeof MOODS)[number] }) => {
      const t = ensureTonight(family);
      for (const v of [checkBedtime(family), checkPageText(family, args.text)]) if (!v.ok) return err(`Guardrail ${v.rule}: ${v.detail}`);
      const unknown = args.characters.filter((n) => !family.cast.some((c) => c.name.toLowerCase() === n.toLowerCase()));
      if (unknown.length) return err(`Unknown cast member(s): ${unknown.join(", ")}. Use add_character first or pick from: ${family.cast.map((c) => c.name).join(", ")}.`);
      const page: StoryPage = {
        night: t.night,
        pageNumber: t.pages.length + 1,
        text: args.text.trim(),
        scene: args.scene,
        characters: castRefs(family, args.characters).map((c) => c.name),
        props: args.props ?? [],
        timeOfDay: args.timeOfDay,
        mood: args.mood,
      };
      t.pages.push(page);
      await saveFamily(family);
      const left = family.settings.pagesPerNight - t.pages.length;
      return ok(
        `Page ${page.pageNumber} shown (${SCENE_LABELS[page.scene]}). ${left > 0 ? `${left} page(s) left tonight: offer_choices next.` : "That was the last page tonight: call end_chapter now."}`,
        { view: "page", night: t.night, page, pagesPerNight: family.settings.pagesPerNight, pagesLeft: left, svg: pageSvg(family, page), sceneLabel: SCENE_LABELS[page.scene] },
      );
    },
  );

  registerAppTool(
    s,
    "offer_choices",
    {
      title: "Offer story choices",
      description: "Show 2-3 short choices so the child decides what happens next. The child answers by voice or by tapping a choice.",
      inputSchema: {
        question: z.string().min(5).max(90),
        choices: z.array(z.object({ label: z.string().min(2).max(60), emoji: z.string().max(4).optional() })).min(2).max(3),
      },
      _meta: ui,
    },
    async (args: { question: string; choices: { label: string; emoji?: string }[] }) => {
      const t = ensureTonight(family);
      for (const v of [checkBedtime(family), checkStoryFlow(family), checkChoices(family, args.question, args.choices)]) {
        if (!v.ok) return err(`Guardrail ${v.rule}: ${v.detail}`);
      }
      t.lastChoices = args.choices.map((c) => c.label);
      t.choicesAtPage = t.pages.length;
      await saveFamily(family);
      const lp = lastPage(family);
      return ok(`Choices shown: ${t.lastChoices.join(" | ")}. Wait for ${family.child.firstName} to pick.`, {
        view: "choices",
        child: family.child.firstName,
        night: t.night,
        question: args.question,
        choices: args.choices,
        page: lp ?? null,
        pagesPerNight: family.settings.pagesPerNight,
        sceneLabel: lp ? SCENE_LABELS[lp.scene] : "",
        svg: lp ? pageSvg(family, lp) : null,
      });
    },
  );

  registerAppTool(
    s,
    "add_character",
    {
      title: "Add a character",
      description: "Add a character the child invents to the saga cast so they come back on future nights.",
      inputSchema: {
        name: z.string().min(1).max(24),
        kind: z.string().min(2).max(24).describe("One of: child, fox, hedgehog, owl, turtle, whale, bunny, dragon, bear, cat, mouse, robot"),
        trait: z.string().min(3).max(120),
      },
      _meta: ui,
    },
    async (args: { name: string; kind: string; trait: string }) => {
      const v = checkCharacter(family, args);
      if (!v.ok) return err(`Guardrail ${v.rule}: ${v.detail}`);
      const t = ensureTonight(family);
      const member = { name: args.name.trim(), kind: args.kind.toLowerCase() as Family["cast"][number]["kind"], trait: args.trait.trim(), addedOnNight: t.night };
      family.cast.push(member);
      await saveFamily(family);
      const svg = illustrate({ scene: lastPage(family)?.scene ?? "starry_meadow", timeOfDay: "moonrise", cast: [{ name: member.name, kind: member.kind }], props: [], mood: "wonder", seed: member.name });
      return ok(`${member.name} the ${member.kind} joined the saga and will be remembered on future nights.`, { view: "character", member, svg, child: family.child.firstName });
    },
  );

  registerAppTool(
    s,
    "end_chapter",
    {
      title: "End tonight's chapter",
      description: "Wind down with a sleepy, happy ending. Saves tonight as a chapter with a title, a one-paragraph summary and a gentle cliffhanger for tomorrow night.",
      inputSchema: {
        title: z.string().min(3).max(80),
        summary: z.string().min(20).max(900).describe("One short paragraph summarizing tonight's chapter."),
        cliffhanger: z.string().min(10).max(300),
        goodnight: z.string().min(5).max(300).describe("A soft goodnight line spoken to the child."),
      },
      _meta: ui,
    },
    async (args: { title: string; summary: string; cliffhanger: string; goodnight: string }) => {
      const t = family.tonight;
      if (!t || t.pages.length === 0) return err("Nothing told tonight yet. Tell at least one page first.");
      const v = checkPageText(family, `${args.summary} ${args.cliffhanger} ${args.goodnight}`, 0);
      if (!v.ok) return err(`Guardrail ${v.rule}: ${v.detail}`);
      family.chapters.push({ night: t.night, title: args.title, summary: args.summary, cliffhanger: args.cliffhanger, pages: t.pages, endedAt: new Date().toISOString() });
      family.tonight = null;
      await saveFamily(family);
      const lp = t.pages.at(-1)!;
      return ok(`Chapter ${t.night} "${args.title}" saved. Tomorrow's saga will pick up from: ${args.cliffhanger}`, {
        view: "goodnight",
        night: t.night,
        title: args.title,
        goodnight: args.goodnight,
        cliffhanger: args.cliffhanger,
        child: family.child.firstName,
        svg: pageSvg(family, { ...lp, timeOfDay: "moonrise", mood: "sleepy" }),
      });
    },
  );

  registerAppTool(
    s,
    "open_saga_book",
    {
      title: "Open the saga book",
      description: "Show the family's saga book: every chapter so far with its illustration.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
      _meta: ui,
    },
    async () => {
      const chapters = family.chapters.map((c) => ({ night: c.night, title: c.title, summary: c.summary, pages: c.pages.length, svg: pageSvg(family, c.pages[0]) }));
      return ok(`${family.child.firstName}'s saga book has ${chapters.length} chapter(s): ${chapters.map((c) => c.title).join("; ")}.`, {
        view: "book",
        child: family.child.firstName,
        familyName: family.familyName,
        chapters,
      });
    },
  );

  registerAppTool(
    s,
    "preview_keepsake_book",
    {
      title: "Preview a printed keepsake book",
      description: "Prepare a printed hardcover keepsake of the saga so far and show an order card. Only a parent can confirm it on the card.",
      inputSchema: {},
      _meta: ui,
    },
    async () => {
      if (family.chapters.length === 0) return err("The saga book is empty. Finish a chapter first.");
      family.orders = family.orders.filter((o) => o.status !== "pending_parent");
      const order = { id: `KS-${newId(4).toUpperCase()}`, approvalCode: newId(6), chapters: family.chapters.length, priceUsd: 24.99, status: "pending_parent" as const, createdAt: new Date().toISOString() };
      family.orders.push(order);
      await saveFamily(family);
      const cover = family.chapters.at(-1)!.pages[0];
      return {
        // The approval code goes only to the parent-facing card (structuredContent), never to the model.
        content: [{ type: "text", text: `Keepsake order ${order.id} prepared: ${order.chapters} chapters, hardcover, $${order.priceUsd} (simulated payment). Waiting for a parent to confirm on the card.` }],
        structuredContent: {
          view: "checkout",
          order: { id: order.id, chapters: order.chapters, priceUsd: order.priceUsd, pages: family.chapters.reduce((n, c) => n + c.pages.length, 0) },
          approvalCode: order.approvalCode,
          child: family.child.firstName,
          titles: family.chapters.map((c) => c.title),
          subscription: family.subscription,
          svg: pageSvg(family, cover),
        },
      };
    },
  );

  registerAppTool(
    s,
    "confirm_keepsake_order",
    {
      title: "Confirm keepsake order",
      description: "Place the pending keepsake order. Requires the approval code that the parent's tap on the order card sends.",
      inputSchema: { approvalCode: z.string().min(4).max(32) },
      _meta: ui,
    },
    async (args: { approvalCode: string }) => {
      const v = checkKeepsakeConfirm(family, args.approvalCode);
      if (!v.ok) return err(`Guardrail ${v.rule}: ${v.detail}`);
      const order = family.orders.find((o) => o.status === "pending_parent")!;
      order.status = "placed";
      await saveFamily(family);
      const eta = new Date(Date.now() + 6 * 864e5).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      return ok(`Order ${order.id} placed (simulated). Arrives ${eta}.`, { view: "receipt", order: { id: order.id, chapters: order.chapters, priceUsd: order.priceUsd }, eta, child: family.child.firstName });
    },
  );

  return server;
}
