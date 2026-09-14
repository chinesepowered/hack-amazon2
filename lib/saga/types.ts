import type { SceneId, CharacterKind, PropId, TimeOfDay, Mood } from "@/lib/art/catalog";

export type AgeBand = "3-5" | "6-8";

export type ParentSettings = {
  ageBand: AgeBand;
  pagesPerNight: number;
  gentleThemesOnly: boolean;
  keepsakeNeedsParent: boolean;
};

export type CastMember = { name: string; kind: CharacterKind; trait: string; addedOnNight: number };

export type StoryPage = {
  night: number;
  pageNumber: number;
  text: string;
  scene: SceneId;
  characters: string[];
  props: PropId[];
  timeOfDay: TimeOfDay;
  mood: Mood;
};

export type Chapter = {
  night: number;
  title: string;
  summary: string;
  cliffhanger: string;
  pages: StoryPage[];
  endedAt: string;
};

export type Tonight = {
  night: number;
  startedAt: string;
  pages: StoryPage[];
  lastChoices: string[];
  /** Page count when choices were last offered (story-flow guardrail). */
  choicesAtPage?: number;
};

export type KeepsakeOrder = {
  id: string;
  approvalCode: string;
  chapters: number;
  priceUsd: number;
  status: "pending_parent" | "placed";
  createdAt: string;
};

export type Family = {
  id: string;
  familyName: string;
  child: { firstName: string; age: number };
  settings: ParentSettings;
  subscription: { plan: "Saga Plus"; status: "active"; renews: string };
  cast: CastMember[];
  favorites: string[];
  chapters: Chapter[];
  tonight: Tonight | null;
  orders: KeepsakeOrder[];
  updatedAt: string;
};
