// Tiny in-memory sliding-window limiter. On serverless it is per instance (documented in README);
// it exists to keep one visitor from draining the shared model key.
const hits = new Map<string, number[]>();

export function rateLimited(req: Request, bucket: string, limit: number, windowMs: number): boolean {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const k = `${bucket}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(k, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > limit;
}
