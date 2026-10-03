// Fixed-window counters, shared across instances through Redis when REDIS_URL is set.
import { incrWithTtl, redis } from "./redis.ts";

const hits = new Map<string, { n: number; reset: number }>();

function memIncr(key: string, windowMs: number, now: number): number {
  const h = hits.get(key);
  if (!h || now > h.reset) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 50_000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    return 1;
  }
  return ++h.n;
}

async function incr(key: string, windowMs: number, now: number): Promise<number> {
  const r = redis();
  return r ? incrWithTtl(r, `wp:rl:${key}`, windowMs) : memIncr(key, windowMs, now);
}

/** True if the action is allowed: `key` has been used at most `max` times in the current window. */
export async function allow(key: string, max: number, windowMs: number, now = Date.now()): Promise<boolean> {
  return (await incr(key, windowMs, now)) <= max;
}

/** Login protection: only failures are counted, so normal use never locks anyone out. */
export async function blocked(key: string, max: number, now = Date.now()): Promise<boolean> {
  const r = redis();
  if (r) return Number((await r.get(`wp:rl:${key}`)) ?? 0) >= max;
  const h = hits.get(key);
  return !!h && now <= h.reset && h.n >= max;
}
export async function recordFailure(key: string, windowMs: number, now = Date.now()): Promise<void> {
  await incr(key, windowMs, now);
}
