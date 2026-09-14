import { type AccessToken, bearerFrom, verify } from "@/lib/auth/tokens";
import { seedFamily } from "@/lib/saga/seed";
import { loadFamily, saveFamily, storageKind } from "@/lib/saga/store";

export const runtime = "nodejs";

async function auth(req: Request) {
  const token = verify<AccessToken>(bearerFrom(req), "access");
  if (!token) return null;
  return loadFamily(token.sub);
}

// Display-only profile summary for the smart display's "linked account" panel.
export async function GET(req: Request) {
  const f = await auth(req);
  if (!f) return Response.json({ error: "not linked" }, { status: 401 });
  return Response.json({
    familyName: f.familyName,
    child: f.child.firstName,
    night: f.tonight?.night ?? f.chapters.length + 1,
    pagesTonight: f.tonight?.pages.length ?? 0,
    chapters: f.chapters.length,
    cast: f.cast.map((c) => ({ name: c.name, kind: c.kind })),
    settings: f.settings,
    subscription: f.subscription,
    storage: storageKind,
  });
}

// Demo reset: put the same family back to "night 1 finished" so the demo is repeatable.
export async function POST(req: Request) {
  const f = await auth(req);
  if (!f) return Response.json({ error: "not linked" }, { status: 401 });
  await saveFamily(seedFamily(f.id, f.familyName, f.child.firstName));
  return Response.json({ ok: true });
}
