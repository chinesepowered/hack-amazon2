import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import type { Family } from "./types";

// Family profiles persist across sessions ("nights"). In production they live as PRIVATE
// objects in Vercel Blob (never publicly addressable); locally they are JSON files in .data/.
// Keys are unguessable random family ids minted during OAuth account linking.

const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const localDir = process.env.VERCEL ? "/tmp/saga-data" : path.join(process.cwd(), ".data");

const key = (id: string) => `families/${id.replace(/[^\w-]/g, "")}.json`;

export async function loadFamily(id: string): Promise<Family | null> {
  if (useBlob) {
    const res = await get(key(id), { access: "private", useCache: false }).catch(() => null);
    if (!res || res.statusCode !== 200) return null;
    return JSON.parse(await new Response(res.stream).text()) as Family;
  }
  try {
    return JSON.parse(await fs.readFile(path.join(localDir, key(id)), "utf8")) as Family;
  } catch {
    return null;
  }
}

export async function saveFamily(family: Family): Promise<void> {
  family.updatedAt = new Date().toISOString();
  const body = JSON.stringify(family);
  if (useBlob) {
    await put(key(family.id), body, {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return;
  }
  const file = path.join(localDir, key(family.id));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
}

export const storageKind = useBlob ? "Vercel Blob (private)" : process.env.VERCEL ? "ephemeral /tmp" : "local .data/";
