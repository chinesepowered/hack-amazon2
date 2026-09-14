import type { CharacterKind, Mood, PropId, SceneId, TimeOfDay } from "./catalog";

// Hand-authored, layered SVG illustration library. A page's picture is a pure function of
// (scene, time of day, cast, props, mood): same story state, same picture, every night.

export type CastRef = { name: string; kind: CharacterKind };
export type IllustrationSpec = {
  scene: SceneId;
  timeOfDay: TimeOfDay;
  cast: CastRef[];
  props: PropId[];
  mood: Mood;
  seed?: string;
};

const W = 800;
const H = 500;

const INK = "#2b2140";
const CREAM = "#fff4dc";
const AMBER = "#ffb54c";
const ROSE = "#f2998c";
const SAGE = "#8fc0a0";
const TEAL = "#4f9fa8";
const SAND = "#e9c897";
const PLUM = "#5b3f78";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let x = hash(seed) || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

const SKIES: Record<TimeOfDay, [string, string, string]> = {
  dusk: ["#3b2d63", "#b0578a", "#f6a36b"],
  night: ["#0f1638", "#23295c", "#43407a"],
  moonrise: ["#1b2150", "#3c3a7a", "#8a6aa8"],
};

function sky(t: TimeOfDay, id: string) {
  const [a, b, c] = SKIES[t];
  return `<defs>
  <linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${a}"/><stop offset="0.62" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>
  </linearGradient>
  <radialGradient id="glow-${id}" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${AMBER}" stop-opacity="0.9"/><stop offset="1" stop-color="${AMBER}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="moonglow-${id}" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="${CREAM}" stop-opacity="0.55"/><stop offset="1" stop-color="${CREAM}" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky-${id})"/>`;
}

function stars(r: () => number, count: number, maxY: number) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = Math.round(r() * W);
    const y = Math.round(r() * maxY);
    const s = (0.8 + r() * 1.8).toFixed(1);
    const d = (2 + r() * 4).toFixed(1);
    out += `<circle class="tw" style="animation-duration:${d}s;animation-delay:-${(r() * 4).toFixed(1)}s" cx="${x}" cy="${y}" r="${s}" fill="${CREAM}"/>`;
  }
  return out;
}

function moon(x: number, y: number, t: TimeOfDay, id: string) {
  const size = t === "moonrise" ? 46 : 34;
  const yy = t === "dusk" ? y + 30 : y;
  return `<circle cx="${x}" cy="${yy}" r="${size * 2.6}" fill="url(#moonglow-${id})"/>
<circle cx="${x}" cy="${yy}" r="${size}" fill="${CREAM}"/>
<circle cx="${x - size * 0.3}" cy="${yy - size * 0.2}" r="${size * 0.16}" fill="#f1e2bf"/>
<circle cx="${x + size * 0.28}" cy="${yy + size * 0.25}" r="${size * 0.11}" fill="#f1e2bf"/>`;
}

function hills(color: string, base: number, amp: number, phase: number, opacity = 1) {
  let d = `M0 ${H} L0 ${base}`;
  for (let x = 0; x <= W; x += 40) {
    const y = base - Math.sin((x / W) * Math.PI * 2 + phase) * amp - Math.sin((x / W) * Math.PI * 5 + phase * 2) * (amp / 3);
    d += ` L${x} ${y.toFixed(1)}`;
  }
  d += ` L${W} ${H} Z`;
  return `<path d="${d}" fill="${color}" opacity="${opacity}"/>`;
}

function pine(x: number, y: number, s: number, color: string) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-4" y="-6" width="8" height="18" fill="#3a2a36"/>
<path d="M0 -92 L30 -40 L16 -40 L38 -6 L-38 -6 L-16 -40 L-30 -40 Z" fill="${color}"/></g>`;
}

function roundTree(x: number, y: number, s: number, color: string) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-5" y="-30" width="10" height="34" rx="4" fill="#4a3240"/>
<circle cx="0" cy="-58" r="34" fill="${color}"/><circle cx="-24" cy="-40" r="20" fill="${color}"/><circle cx="24" cy="-42" r="22" fill="${color}"/></g>`;
}

function cloud(x: number, y: number, s: number, color: string, drift = true) {
  return `<g class="${drift ? "drift" : ""}" transform="translate(${x} ${y}) scale(${s})"><g>
<ellipse cx="0" cy="0" rx="60" ry="22" fill="${color}"/><circle cx="-24" cy="-12" r="24" fill="${color}"/><circle cx="16" cy="-20" r="30" fill="${color}"/><circle cx="46" cy="-4" r="18" fill="${color}"/></g></g>`;
}

function house(x: number, y: number, s: number, wall: string, roof: string) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-34" y="-50" width="68" height="50" fill="${wall}"/>
<path d="M-44 -48 L0 -88 L44 -48 Z" fill="${roof}"/>
<rect class="win" x="-22" y="-38" width="16" height="16" rx="3" fill="${AMBER}"/><rect class="win" x="6" y="-38" width="16" height="16" rx="3" fill="${AMBER}"/>
<rect x="-8" y="-22" width="16" height="22" rx="7" fill="#3a2a36"/></g>`;
}

function lanternString(y: number, r: () => number) {
  let out = `<path d="M0 ${y} Q ${W / 2} ${y + 40} ${W} ${y}" stroke="#2d2340" stroke-width="2" fill="none"/>`;
  for (let i = 1; i < 9; i++) {
    const x = (W / 9) * i;
    const yy = y + Math.sin((i / 9) * Math.PI) * 20 + 10;
    const c = [AMBER, ROSE, "#ffd66e"][Math.floor(r() * 3)];
    out += `<g class="glow"><circle cx="${x}" cy="${yy + 8}" r="22" fill="${c}" opacity="0.25"/><rect x="${x - 8}" y="${yy}" width="16" height="20" rx="6" fill="${c}"/></g>`;
  }
  return out;
}

function backdrop(scene: SceneId, t: TimeOfDay, r: () => number, id: string): string {
  const s = sky(t, id);
  const st = stars(r, t === "dusk" ? 18 : 60, 280);
  switch (scene) {
    case "starry_meadow":
      return `${s}${st}${moon(640, 110, t, id)}${hills("#2f3a6b", 360, 30, 1.2)}${hills("#3f5a6e", 400, 22, 2.4)}${hills("#4d7560", 440, 14, 0.4)}
${[80, 190, 520, 700].map((x) => `<g class="sway"><path d="M${x} 450 q 6 -30 0 -52" stroke="#6fa37f" stroke-width="3" fill="none"/><circle cx="${x}" cy="398" r="7" fill="${ROSE}"/></g>`).join("")}`;
    case "whispering_forest":
      return `${s}${st}${moon(160, 100, t, id)}${hills("#243058", 380, 20, 0.5)}
${[40, 140, 250, 560, 660, 760].map((x, i) => pine(x, 420 - (i % 2) * 20, 1.4 + (i % 3) * 0.25, i % 2 ? "#2f4f5e" : "#35625a")).join("")}
${hills("#3c5a4c", 450, 10, 1.7)}${[300, 420, 500].map((x) => `<circle class="tw" cx="${x}" cy="${330 + r() * 60}" r="3" fill="#e8ff9a"/>`).join("")}`;
    case "moonlit_seaside":
      return `${s}${st}${moon(600, 120, t, id)}
<rect y="300" width="${W}" height="200" fill="#28457a"/><path d="M560 300 h80 l30 200 h-140 z" fill="${CREAM}" opacity="0.12"/>
${[330, 360, 390].map((y, i) => `<path class="wave" d="M0 ${y} q 50 -12 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0 t 100 0" stroke="#7fb3d6" stroke-opacity="${0.5 - i * 0.12}" stroke-width="3" fill="none"/>`).join("")}
<path d="M0 430 Q 300 395 ${W} 440 L${W} ${H} L0 ${H} Z" fill="${SAND}"/><path d="M0 460 Q 300 430 ${W} 470 L${W} ${H} L0 ${H} Z" fill="#d9b27d"/>`;
    case "cloud_kingdom":
      return `${s}${st}${moon(120, 90, t, id)}
${cloud(620, 150, 1.2, "#8f86c8")}${cloud(220, 230, 0.9, "#9e95d4")}
<g transform="translate(560 330)"><rect x="-70" y="-120" width="140" height="120" fill="#c9bfee"/><rect x="-90" y="-170" width="40" height="170" fill="#b8addf"/><rect x="50" y="-170" width="40" height="170" fill="#b8addf"/>
<path d="M-96 -170 L-70 -210 L-44 -170 Z M44 -170 L70 -210 L96 -170 Z" fill="${ROSE}"/><rect class="win" x="-14" y="-90" width="28" height="36" rx="14" fill="${AMBER}"/></g>
${cloud(140, 420, 2.2, "#b6aee6", false)}${cloud(470, 440, 2.6, "#c7c0f0", false)}${cloud(760, 420, 2, "#b6aee6", false)}`;
    case "cozy_treehouse":
      return `${s}${st}${moon(680, 90, t, id)}${hills("#2e4a4f", 430, 16, 0.9)}
<g transform="translate(360 470)"><rect x="-26" y="-300" width="52" height="300" rx="14" fill="#5a3b3e"/>
<circle cx="-60" cy="-330" r="90" fill="#35625a"/><circle cx="70" cy="-310" r="80" fill="#3d6f60"/><circle cx="0" cy="-390" r="80" fill="#428070"/>
<rect x="-90" y="-250" width="180" height="90" rx="8" fill="#b07a55"/><path d="M-110 -246 L0 -310 L110 -246 Z" fill="#8a4f4f"/>
<rect class="win" x="-58" y="-230" width="36" height="32" rx="6" fill="${AMBER}"/><rect class="win" x="22" y="-230" width="36" height="32" rx="6" fill="${AMBER}"/>
<path d="M60 -160 L60 -20 M90 -160 L90 -20" stroke="#8a6a55" stroke-width="4"/>${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M60 ${-140 + i * 24} H90" stroke="#8a6a55" stroke-width="4"/>`).join("")}</g>`;
    case "snowy_hill":
      return `${s}${st}${moon(150, 110, t, id)}${hills("#9fb0d9", 380, 30, 2.1)}${hills("#dfe6f7", 430, 22, 0.8)}
${pine(640, 420, 1.3, "#2f5560")}${pine(700, 440, 1, "#35625a")}
${Array.from({ length: 40 }, () => `<circle class="snow" style="animation-delay:-${(r() * 8).toFixed(1)}s" cx="${Math.round(r() * W)}" cy="${Math.round(r() * 400)}" r="${(1 + r() * 2).toFixed(1)}" fill="#fff"/>`).join("")}`;
    case "lantern_village":
      return `${s}${st}${moon(700, 80, t, id)}${hills("#2a3160", 390, 18, 1.4)}
${house(120, 440, 1.3, "#e2b8a0", "#7b4a6a")}${house(300, 450, 1.1, "#d6c7a8", "#5b5a8a")}${house(520, 440, 1.4, "#e8c9a6", "#8a4f4f")}${house(700, 455, 1, "#cfb3c8", "#4f6a8a")}
${lanternString(160, r)}<rect y="450" width="${W}" height="50" fill="#3a3350"/>`;
    case "underwater_garden":
      return `<defs><linearGradient id="sea-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f4f7a"/><stop offset="1" stop-color="#123255"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#sea-${id})"/>
${[120, 260, 480, 690].map((x) => `<path d="M${x} 80 L${x + 70} 500 L${x - 30} 500 Z" fill="${CREAM}" opacity="0.06"/>`).join("")}
${Array.from({ length: 16 }, () => `<circle class="bubble" style="animation-delay:-${(r() * 6).toFixed(1)}s" cx="${Math.round(r() * W)}" cy="${Math.round(300 + r() * 180)}" r="${(3 + r() * 5).toFixed(1)}" fill="none" stroke="#bfe3ff" stroke-opacity="0.6" stroke-width="2"/>`).join("")}
${[60, 180, 600, 730].map((x, i) => `<path class="sway" d="M${x} 500 C ${x - 30} 420 ${x + 30} 380 ${x} ${300 - i * 10}" stroke="${i % 2 ? TEAL : SAGE}" stroke-width="10" fill="none" stroke-linecap="round"/>`).join("")}
<path d="M0 470 Q 400 430 ${W} 470 L${W} ${H} L0 ${H} Z" fill="#c9a77a"/>${[330, 470].map((x) => `<circle cx="${x}" cy="468" r="16" fill="${ROSE}"/><circle cx="${x + 22}" cy="474" r="10" fill="${AMBER}"/>`).join("")}`;
    case "mountain_lake":
      return `${s}${st}${moon(560, 110, t, id)}
<path d="M0 330 L140 160 L240 280 L360 130 L520 300 L640 190 L${W} 320 L${W} 340 L0 340 Z" fill="#3b4478"/>
<path d="M360 130 L330 170 L380 175 Z M140 160 L120 190 L165 188 Z" fill="${CREAM}" opacity="0.9"/>
<rect y="330" width="${W}" height="120" fill="#27386a"/><path d="M0 332 L140 440 L240 360 L360 470 L520 350 L640 420 L${W} 336 Z" fill="#3b4478" opacity="0.35"/>
<ellipse cx="560" cy="400" rx="30" ry="60" fill="${CREAM}" opacity="0.14"/>${hills("#34574e", 460, 10, 0.3)}`;
    case "desert_dunes":
      return `${s}${stars(r, 80, 300)}${moon(200, 110, t, id)}${hills("#9a6a6e", 370, 36, 0.2)}${hills("#c28a6a", 420, 28, 2.6)}${hills(SAND, 460, 18, 1.1)}
<g transform="translate(640 440)"><rect x="-8" y="-90" width="16" height="90" rx="8" fill="#5f8a5a"/><rect x="-34" y="-66" width="12" height="40" rx="6" fill="#5f8a5a"/><rect x="22" y="-76" width="12" height="44" rx="6" fill="#5f8a5a"/></g>`;
    case "sleepy_library":
      return `<rect width="${W}" height="${H}" fill="#3a2a48"/>
${[0, 1, 2].map((row) => `<rect x="30" y="${60 + row * 130}" width="740" height="12" fill="#6b4a3e"/>${Array.from({ length: 22 }, (_, i) => `<rect x="${40 + i * 33}" y="${60 + row * 130 - 70 - Math.round(r() * 20)}" width="26" height="${70 + Math.round(r() * 20)}" rx="3" fill="${[ROSE, TEAL, AMBER, SAGE, PLUM, "#c98f6a"][Math.floor(r() * 6)]}" opacity="0.85"/>`).join("")}`).join("")}
<rect x="560" y="60" width="160" height="140" rx="80" fill="${SKIES[t][1]}"/>${moon(640, 125, "night", id)}
<g class="glow"><circle cx="160" cy="440" r="80" fill="url(#glow-${id})"/></g><rect y="440" width="${W}" height="60" fill="#5a3b3e"/>
<defs><radialGradient id="glow-${id}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${AMBER}" stop-opacity="0.9"/><stop offset="1" stop-color="${AMBER}" stop-opacity="0"/></radialGradient>
<radialGradient id="moonglow-${id}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${CREAM}" stop-opacity="0.55"/><stop offset="1" stop-color="${CREAM}" stop-opacity="0"/></radialGradient></defs>`;
    case "star_bridge":
      return `${s}${stars(r, 110, 480)}${moon(400, 90, t, id)}
<path d="M-20 460 Q 400 200 820 460" stroke="${CREAM}" stroke-opacity="0.18" stroke-width="46" fill="none"/>
<path d="M-20 460 Q 400 200 820 460" stroke="#ffe7a8" stroke-width="6" stroke-dasharray="2 18" stroke-linecap="round" fill="none" class="glow"/>
${cloud(120, 470, 2, "#43407a", false)}${cloud(680, 480, 2.2, "#4b4786", false)}`;
  }
}

// ---------- characters (drawn facing right, ground at y=0, ~120px tall at scale 1) ----------

const FUR: Record<CharacterKind, string[]> = {
  child: ["#8a5a44", "#c98f6a", "#5a3b2e"],
  fox: ["#f08a4b", "#e07a3a", "#f3a35c"],
  hedgehog: ["#9b7358", "#8a6a55", "#b08a6a"],
  owl: ["#a98a6a", "#8f7a9a", "#b59a7a"],
  turtle: ["#6fae84", "#5f9e8a", "#7fbf8a"],
  whale: ["#6a8fd0", "#7a9ae0", "#5f7fc0"],
  bunny: ["#f3e6e0", "#e8d8cf", "#d9c6bd"],
  dragon: ["#8fcf9a", "#b38fd8", "#f2a07a"],
  bear: ["#a3775a", "#8f6a50", "#b8896a"],
  cat: ["#6b6b86", "#d99a5a", "#f0e2d0"],
  mouse: ["#b6aab0", "#c9bcc2", "#9e9098"],
  robot: ["#9fc6d6", "#c6b8e6", "#e6c89f"],
};

const eye = (x: number, y: number, r = 4) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="#fff"/>`;
const blush = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3.5" fill="${ROSE}" opacity="0.7"/>`;

function characterBody(kind: CharacterKind, c: string, sleepy: boolean): string {
  const e = (x: number, y: number, r?: number) =>
    sleepy ? `<path d="M${x - 4} ${y} q 4 3 8 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` : eye(x, y, r);
  switch (kind) {
    case "child":
      return `<rect x="-22" y="-62" width="44" height="58" rx="18" fill="#6c7fd6"/><rect x="-22" y="-10" width="44" height="10" rx="4" fill="#4f5fb0"/>
<circle cx="0" cy="-86" r="26" fill="#f2c7a5"/><path d="M-27 -90 q 2 -34 30 -30 q 26 2 24 30 q -10 -14 -28 -12 q -16 0 -26 12z" fill="${c}"/>
<circle cx="24" cy="-98" r="8" fill="${c}"/>${e(-8, -86)}${e(9, -86)}${blush(-14, -76)}${blush(15, -76)}<path d="M-5 -72 q 5 4 10 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case "fox":
      return `<path d="M-40 -20 q -30 -10 -20 -40 q 10 18 30 18 z" fill="${c}"/><path d="M-52 -46 q 6 8 14 6" stroke="#fff4dc" stroke-width="6" fill="none" stroke-linecap="round"/>
<ellipse cx="0" cy="-26" rx="32" ry="24" fill="${c}"/><ellipse cx="6" cy="-18" rx="16" ry="12" fill="${CREAM}"/>
<path d="M4 -46 L10 -84 L26 -56 Z M26 -56 L44 -80 L44 -46 Z" fill="${c}"/><ellipse cx="26" cy="-50" rx="24" ry="20" fill="${c}"/>
<path d="M36 -44 q 14 4 16 10 q -10 4 -20 0z" fill="${CREAM}"/><circle cx="52" cy="-35" r="3.5" fill="${INK}"/>${e(26, -54)}${blush(20, -42)}`;
    case "hedgehog":
      return `<path d="M-38 -10 ${Array.from({ length: 9 }, (_, i) => `L${-36 + i * 8} ${-46 - (i % 2) * 14}`).join(" ")} L34 -10 Z" fill="#6b4f40"/>
<ellipse cx="0" cy="-20" rx="36" ry="22" fill="${c}"/><ellipse cx="28" cy="-18" rx="16" ry="13" fill="#f2d9c0"/><circle cx="44" cy="-18" r="3.5" fill="${INK}"/>${e(26, -24, 3.5)}${blush(22, -12)}`;
    case "owl":
      return `<ellipse cx="0" cy="-40" rx="32" ry="40" fill="${c}"/><ellipse cx="0" cy="-30" rx="20" ry="26" fill="${CREAM}" opacity="0.8"/>
<path d="M-30 -74 L-22 -92 L-10 -76 Z M30 -74 L22 -92 L10 -76 Z" fill="${c}"/>
<circle cx="-12" cy="-58" r="12" fill="#fff4dc"/><circle cx="12" cy="-58" r="12" fill="#fff4dc"/>${e(-12, -58, 5)}${e(12, -58, 5)}
<path d="M-4 -46 L4 -46 L0 -38 Z" fill="${AMBER}"/><path d="M-10 -2 l-4 6 M10 -2 l4 6" stroke="${AMBER}" stroke-width="3"/>`;
    case "turtle":
      return `<ellipse cx="-4" cy="-26" rx="42" ry="28" fill="#5a8a6a"/><path d="M-30 -30 h52 M-4 -52 v48 M-24 -46 l40 36 M16 -46 l-40 36" stroke="${c}" stroke-width="3" opacity="0.6"/>
<ellipse cx="46" cy="-24" rx="16" ry="14" fill="${c}"/>${e(50, -28, 3.5)}<rect x="-30" y="-8" width="14" height="10" rx="5" fill="${c}"/><rect x="14" y="-8" width="14" height="10" rx="5" fill="${c}"/>`;
    case "whale":
      return `<path d="M-90 -40 q 10 -60 100 -60 q 90 0 90 60 q 0 40 -90 40 q -60 0 -100 -40z" fill="${c}"/>
<path d="M-86 -44 q -30 -10 -34 -34 q 22 8 34 20 q 4 -26 26 -34 q -6 26 -22 48z" fill="${c}"/>
<path d="M-40 -16 q 60 26 130 -8 q -20 30 -80 30 q -34 0 -50 -22z" fill="#dce8ff" opacity="0.7"/>${e(60, -54, 5)}${blush(58, -40)}
<path d="M20 -104 q 0 -20 -12 -30 M20 -104 q 0 -20 12 -30" stroke="#bfe3ff" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case "bunny":
      return `<ellipse cx="0" cy="-26" rx="28" ry="26" fill="${c}"/><ellipse cx="4" cy="-62" rx="22" ry="20" fill="${c}"/>
<ellipse cx="-6" cy="-100" rx="7" ry="24" fill="${c}"/><ellipse cx="12" cy="-102" rx="7" ry="24" fill="${c}"/><ellipse cx="12" cy="-100" rx="3" ry="16" fill="${ROSE}" opacity="0.6"/>
${e(-2, -64)}${e(14, -64)}${blush(-8, -54)}${blush(20, -54)}<circle cx="-26" cy="-20" r="9" fill="#fff"/>`;
    case "dragon":
      return `<path d="M-40 -20 q -40 -4 -50 -30 q 30 10 50 4z" fill="${c}"/><ellipse cx="0" cy="-30" rx="34" ry="28" fill="${c}"/>
<path d="M-12 -52 q -30 -40 -2 -54 q 0 26 18 36z" fill="${ROSE}" opacity="0.85" class="flap"/><ellipse cx="4" cy="-22" rx="18" ry="16" fill="${CREAM}" opacity="0.7"/>
<ellipse cx="32" cy="-62" rx="24" ry="20" fill="${c}"/><path d="M22 -80 l4 -14 l8 12 M38 -80 l6 -12 l6 14" fill="${AMBER}" stroke="${AMBER}" stroke-width="3" stroke-linejoin="round"/>
${e(38, -66)}${blush(30, -54)}<path d="M50 -58 q 6 2 4 8" stroke="${INK}" stroke-width="2" fill="none"/>`;
    case "bear":
      return `<ellipse cx="0" cy="-34" rx="36" ry="34" fill="${c}"/><circle cx="-24" cy="-94" r="11" fill="${c}"/><circle cx="24" cy="-94" r="11" fill="${c}"/>
<circle cx="0" cy="-74" r="28" fill="${c}"/><ellipse cx="0" cy="-64" rx="13" ry="10" fill="#e8cfae"/><circle cx="0" cy="-68" r="4" fill="${INK}"/>${e(-10, -80)}${e(10, -80)}${blush(-18, -66)}${blush(18, -66)}
<ellipse cx="0" cy="-26" rx="18" ry="20" fill="#e8cfae" opacity="0.6"/>`;
    case "cat":
      return `<path d="M-30 -14 q -34 -6 -26 -46" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/><ellipse cx="0" cy="-26" rx="28" ry="26" fill="${c}"/>
<path d="M-18 -74 L-14 -98 L0 -80 Z M18 -74 L14 -98 L0 -80 Z" fill="${c}"/><circle cx="0" cy="-66" r="22" fill="${c}"/>
${e(-8, -68)}${e(8, -68)}${blush(-14, -58)}${blush(14, -58)}<path d="M-3 -60 L3 -60 L0 -56 Z" fill="${ROSE}"/>`;
    case "mouse":
      return `<path d="M-24 -10 q -30 0 -34 -26" stroke="${ROSE}" stroke-width="3" fill="none"/><ellipse cx="0" cy="-18" rx="22" ry="18" fill="${c}"/>
<circle cx="-6" cy="-50" r="14" fill="${c}"/><circle cx="14" cy="-50" r="14" fill="${c}"/><circle cx="14" cy="-50" r="8" fill="${ROSE}" opacity="0.55"/>
<ellipse cx="10" cy="-34" rx="16" ry="14" fill="${c}"/>${e(12, -36, 3)}<circle cx="26" cy="-32" r="3" fill="${ROSE}"/>`;
    case "robot":
      return `<rect x="-26" y="-58" width="52" height="54" rx="12" fill="${c}"/><rect x="-14" y="-44" width="28" height="18" rx="5" fill="#2b2140" opacity="0.2"/>
<rect x="-24" y="-104" width="48" height="40" rx="12" fill="${c}"/><rect x="-16" y="-96" width="32" height="22" rx="8" fill="${INK}"/>
<circle cx="-7" cy="-85" r="4" fill="#9ff0ff"/><circle cx="7" cy="-85" r="4" fill="#9ff0ff"/><path d="M0 -104 v-12" stroke="${INK}" stroke-width="3"/><circle class="glow" cx="0" cy="-118" r="5" fill="${AMBER}"/>`;
  }
}

function drawCharacter(ref: CastRef, x: number, y: number, scale: number, mood: Mood, i: number): string {
  const palette = FUR[ref.kind];
  const color = palette[hash(ref.name) % palette.length];
  const flip = i % 2 === 1 && ref.kind !== "whale" ? -1 : 1;
  const label = `<g transform="translate(0 16)"><rect x="-${ref.name.length * 4.6 + 10}" y="-2" width="${ref.name.length * 9.2 + 20}" height="22" rx="11" fill="${INK}" opacity="0.55"/>
<text x="0" y="14" text-anchor="middle" font-family="Nunito, 'Trebuchet MS', sans-serif" font-size="13" font-weight="700" fill="${CREAM}">${escapeXml(ref.name)}</text></g>`;
  return `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="2" rx="${46 * scale}" ry="${8 * scale}" fill="#000" opacity="0.18"/>
<g class="bob" style="animation-delay:-${i * 0.7}s"><g transform="scale(${scale * flip} ${scale})">${characterBody(ref.kind, color, mood === "sleepy")}</g></g>${label}</g>`;
}

function drawProp(p: PropId, x: number, y: number): string {
  switch (p) {
    case "lantern":
      return `<g transform="translate(${x} ${y})" class="glow"><circle cx="0" cy="-26" r="40" fill="${AMBER}" opacity="0.22"/><path d="M-10 -52 q 10 -12 20 0" stroke="${INK}" stroke-width="3" fill="none"/>
<rect x="-14" y="-50" width="28" height="40" rx="8" fill="#ffd27a"/><rect x="-16" y="-12" width="32" height="8" rx="3" fill="${INK}"/></g>`;
    case "map":
      return `<g transform="translate(${x} ${y}) rotate(-8)"><path d="M-34 -40 L-12 -34 L12 -42 L34 -36 L34 0 L12 -6 L-12 2 L-34 -4 Z" fill="${SAND}" stroke="#b58a5a" stroke-width="2"/>
<path d="M-24 -20 q 16 -14 30 0 t 18 -8" stroke="${ROSE}" stroke-width="2.5" stroke-dasharray="4 4" fill="none"/><path d="M20 -30 l6 6 m0 -6 l-6 6" stroke="${INK}" stroke-width="2.5"/></g>`;
    case "golden_key":
      return `<g transform="translate(${x} ${y}) rotate(-20)" class="glow"><circle cx="-18" cy="-20" r="12" fill="none" stroke="#ffcf5a" stroke-width="6"/><rect x="-6" y="-23" width="40" height="6" rx="3" fill="#ffcf5a"/><rect x="24" y="-18" width="6" height="12" fill="#ffcf5a"/></g>`;
    case "paper_boat":
      return `<g transform="translate(${x} ${y})" class="bob"><path d="M-40 -10 L40 -10 L26 8 L-26 8 Z" fill="#f7efe0"/><path d="M-4 -60 L-4 -10 L-34 -10 Z" fill="#fff"/><path d="M0 -54 L0 -10 L28 -10 Z" fill="#ece0c8"/></g>`;
    case "storybook":
      return `<g transform="translate(${x} ${y})"><path d="M-36 -8 L0 -2 L36 -8 L36 -40 L0 -34 L-36 -40 Z" fill="${TEAL}"/><path d="M-32 -12 L0 -6 L0 -36 L-32 -42 Z" fill="${CREAM}"/><path d="M32 -12 L0 -6 L0 -36 L32 -42 Z" fill="#f5e8cf"/>
<path d="M-24 -30 l18 3 M-24 -22 l18 3 M8 -27 l18 -3 M8 -19 l18 -3" stroke="#b8a488" stroke-width="2"/></g>`;
    case "star_jar":
      return `<g transform="translate(${x} ${y})"><circle class="glow" cx="0" cy="-26" r="34" fill="#ffe9a0" opacity="0.25"/><rect x="-18" y="-50" width="36" height="46" rx="10" fill="#cfe8ff" opacity="0.5" stroke="#eaf4ff" stroke-width="2"/>
<rect x="-14" y="-58" width="28" height="10" rx="3" fill="#b07a55"/>${[-8, 4, -2, 8].map((dx, k) => `<circle class="tw" cx="${dx}" cy="${-40 + k * 9}" r="3" fill="#ffe27a"/>`).join("")}</g>`;
    case "kite":
      return `<g transform="translate(${x} ${y - 180})" class="bob"><path d="M0 -40 L28 0 L0 44 L-28 0 Z" fill="${ROSE}"/><path d="M0 -40 V44 M-28 0 H28" stroke="${CREAM}" stroke-width="2"/>
<path d="M0 44 q 20 40 -10 80 q -20 30 10 60" stroke="${CREAM}" stroke-width="2" fill="none"/></g>`;
    case "blanket":
      return `<g transform="translate(${x} ${y})"><path d="M-60 0 q 0 -24 30 -26 h60 q 30 2 30 26 z" fill="${PLUM}"/><path d="M-48 -10 h96 M-40 -20 h80" stroke="${AMBER}" stroke-width="3" stroke-dasharray="6 6" opacity="0.7"/></g>`;
  }
}

function escapeXml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]!);
}

const STYLE = `<style>
.tw{animation:tw 3s ease-in-out infinite}@keyframes tw{0%,100%{opacity:.35}50%{opacity:1}}
.bob{animation:bob 3.6s ease-in-out infinite}@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.glow{animation:glow 2.8s ease-in-out infinite}@keyframes glow{0%,100%{opacity:.8}50%{opacity:1}}
.drift{animation:drift 14s ease-in-out infinite alternate}@keyframes drift{from{transform:translateX(-12px)}to{transform:translateX(12px)}}
.sway{transform-box:fill-box;transform-origin:bottom center;animation:sway 5s ease-in-out infinite}@keyframes sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
.wave{animation:wave 6s ease-in-out infinite}@keyframes wave{0%,100%{transform:translateX(0)}50%{transform:translateX(-30px)}}
.snow{animation:snow 8s linear infinite}@keyframes snow{from{transform:translateY(-40px)}to{transform:translateY(120px)}}
.bubble{animation:bubble 6s linear infinite}@keyframes bubble{from{transform:translateY(0);opacity:.8}to{transform:translateY(-300px);opacity:0}}
.win{animation:glow 4s ease-in-out infinite}
.flap{transform-box:fill-box;transform-origin:bottom right;animation:flap 1.6s ease-in-out infinite}@keyframes flap{0%,100%{transform:rotate(0)}50%{transform:rotate(-10deg)}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}}
</style>`;

export function illustrate(spec: IllustrationSpec): string {
  const id = (hash(JSON.stringify(spec)) % 1e8).toString(36);
  const r = rng(spec.seed ?? `${spec.scene}|${spec.timeOfDay}`);
  const inSky = (k: CharacterKind) => k === "whale" && ["cloud_kingdom", "star_bridge", "starry_meadow", "snowy_hill", "desert_dunes"].includes(spec.scene);
  const cast = spec.cast.slice(0, 3);
  const ground = spec.scene === "underwater_garden" ? 440 : 462;
  const slotsX = cast.length === 1 ? [400] : cast.length === 2 ? [290, 530] : [200, 400, 610];
  const people = cast
    .map((c, i) => {
      if (inSky(c.kind)) return drawCharacter(c, 560, 250, 1.15, spec.mood, i);
      if (c.kind === "whale") return drawCharacter(c, slotsX[i], ground - 30, 0.95, spec.mood, i);
      return drawCharacter(c, slotsX[i], ground, 1.45, spec.mood, i);
    })
    .join("");
  // Props sit inside the centre band so they survive "slice" cropping on tall cards.
  const propX = [150, 650, 470];
  const props = spec.props
    .slice(0, 3)
    .map((p, i) => drawProp(p, propX[i], ground + 4))
    .join("");
  const sleepyVeil = spec.mood === "sleepy" ? `<rect width="${W}" height="${H}" fill="#0b1030" opacity="0.28"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration">${STYLE}${backdrop(spec.scene, spec.timeOfDay, r, id)}${props}${people}${sleepyVeil}</svg>`;
}
