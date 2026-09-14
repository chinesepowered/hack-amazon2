// The closed vocabulary the storyteller may use. Every illustration is composed
// deterministically from these ids, so the model can never "draw" something off-catalog.

export const SCENES = [
  "starry_meadow",
  "whispering_forest",
  "moonlit_seaside",
  "cloud_kingdom",
  "cozy_treehouse",
  "snowy_hill",
  "lantern_village",
  "underwater_garden",
  "mountain_lake",
  "desert_dunes",
  "sleepy_library",
  "star_bridge",
] as const;
export type SceneId = (typeof SCENES)[number];

export const SCENE_LABELS: Record<SceneId, string> = {
  starry_meadow: "Starry Meadow",
  whispering_forest: "Whispering Forest",
  moonlit_seaside: "Moonlit Seaside",
  cloud_kingdom: "Cloud Kingdom",
  cozy_treehouse: "Cozy Treehouse",
  snowy_hill: "Snowy Hill",
  lantern_village: "Lantern Village",
  underwater_garden: "Underwater Garden",
  mountain_lake: "Mountain Lake",
  desert_dunes: "Desert Dunes",
  sleepy_library: "Sleepy Library",
  star_bridge: "Star Bridge",
};

export const CHARACTER_KINDS = [
  "child",
  "fox",
  "hedgehog",
  "owl",
  "turtle",
  "whale",
  "bunny",
  "dragon",
  "bear",
  "cat",
  "mouse",
  "robot",
] as const;
export type CharacterKind = (typeof CHARACTER_KINDS)[number];

export const PROPS = ["lantern", "map", "golden_key", "paper_boat", "storybook", "star_jar", "kite", "blanket"] as const;
export type PropId = (typeof PROPS)[number];

export const TIMES = ["dusk", "night", "moonrise"] as const;
export type TimeOfDay = (typeof TIMES)[number];

export const MOODS = ["cozy", "wonder", "silly", "sleepy"] as const;
export type Mood = (typeof MOODS)[number];
