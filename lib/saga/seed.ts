import type { Family } from "./types";

// A brand-new linked family starts on night 2 of a saga, so the memory is visible immediately.
// Everything here is fictional demo data.

export function seedFamily(id: string, familyName: string, childFirstName: string): Family {
  const child = childFirstName.trim().slice(0, 20) || "Luna";
  const renews = new Date(Date.now() + 23 * 864e5).toISOString().slice(0, 10);
  const night1 = new Date(Date.now() - 864e5).toISOString();
  return {
    id,
    familyName: familyName.trim().slice(0, 40) || "The Rivera Family",
    child: { firstName: child, age: 5 },
    settings: { ageBand: "3-5", pagesPerNight: 3, gentleThemesOnly: true, keepsakeNeedsParent: true },
    subscription: { plan: "Saga Plus", status: "active", renews },
    cast: [
      { name: child, kind: "child", trait: "brave, curious, loves the color teal", addedOnNight: 1 },
      { name: "Pip", kind: "fox", trait: `${child}'s best friend; carries a lantern that hums when someone is brave`, addedOnNight: 1 },
      { name: "Bramble", kind: "hedgehog", trait: "reads the stars and collects lost buttons", addedOnNight: 1 },
    ],
    favorites: ["whales", "hot cocoa", "the color teal"],
    chapters: [
      {
        night: 1,
        title: "The Map in the Lantern",
        summary: `${child} and Pip found a glowing map folded inside Pip's lantern. Bramble read the stars on it: they point to the Cloud Kingdom, where a sky whale sings the moon to sleep.`,
        cliffhanger: "The map's last star blinked twice, and a long, low hum drifted down from the clouds.",
        endedAt: night1,
        pages: [
          {
            night: 1,
            pageNumber: 1,
            text: `On the edge of the Starry Meadow, ${child} and Pip the fox watched the fireflies come out. Pip's lantern began to hum.`,
            scene: "starry_meadow",
            characters: [child, "Pip"],
            props: ["lantern"],
            timeOfDay: "dusk",
            mood: "wonder",
          },
          {
            night: 1,
            pageNumber: 2,
            text: `Inside the lantern was a folded map that glowed like moonlight. "It's a star map!" said Bramble the hedgehog, pushing up his tiny glasses.`,
            scene: "whispering_forest",
            characters: [child, "Pip", "Bramble"],
            props: ["map"],
            timeOfDay: "night",
            mood: "wonder",
          },
          {
            night: 1,
            pageNumber: 3,
            text: `The stars on the map made a path all the way up to the Cloud Kingdom. ${child} yawned and tucked the map under her pillow for tomorrow.`,
            scene: "cozy_treehouse",
            characters: [child, "Pip"],
            props: ["map", "blanket"],
            timeOfDay: "moonrise",
            mood: "sleepy",
          },
        ],
      },
    ],
    tonight: null,
    orders: [],
    updatedAt: new Date().toISOString(),
  };
}
