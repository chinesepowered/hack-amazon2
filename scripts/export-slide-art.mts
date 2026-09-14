// Renders a few illustrations from the same deterministic SVG library the MCP App uses,
// so the pitch deck shows real product art. Run: node scripts/export-slide-art.mts
import fs from "node:fs";
import path from "node:path";
import { illustrate } from "../lib/art/illustrate.ts";

const out = path.join(process.cwd(), "public", "slides-art");
fs.mkdirSync(out, { recursive: true });

const art = {
  cover: illustrate({ scene: "starry_meadow", timeOfDay: "dusk", cast: [{ name: "Luna", kind: "child" }, { name: "Pip", kind: "fox" }], props: ["lantern"], mood: "wonder", seed: "cover" }),
  whale: illustrate({ scene: "cloud_kingdom", timeOfDay: "night", cast: [{ name: "Luna", kind: "child" }, { name: "Sky Whale", kind: "whale" }], props: ["star_jar"], mood: "wonder", seed: "whale" }),
  dragon: illustrate({ scene: "snowy_hill", timeOfDay: "night", cast: [{ name: "Luna", kind: "child" }, { name: "Ember", kind: "dragon" }, { name: "Bramble", kind: "hedgehog" }], props: ["blanket"], mood: "silly", seed: "dragon" }),
  sleepy: illustrate({ scene: "cozy_treehouse", timeOfDay: "moonrise", cast: [{ name: "Luna", kind: "child" }, { name: "Pip", kind: "fox" }], props: ["storybook"], mood: "sleepy", seed: "sleepy" }),
};

for (const [name, svg] of Object.entries(art)) fs.writeFileSync(path.join(out, `${name}.svg`), svg);
console.log("exported", Object.keys(art).join(", "));
