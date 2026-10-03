// Fixed-window counter. ponytail: in-process, so limits are per app instance; use Redis when running several.
const hits = new Map<string, { n: number; reset: number }>();

/** Returns true if the action is allowed, false if `key` exceeded `max` attempts in the current window. */
export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const h = hits.get(key);
  if (!h || now > h.reset) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 50_000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    return true;
  }
  h.n++;
  return h.n <= max;
}

/** Failure counting for logins: only failed attempts count, so normal use never locks anyone out. */
export function blocked(key: string, max: number, now = Date.now()): boolean {
  const h = hits.get(key);
  return !!h && now <= h.reset && h.n >= max;
}
export function recordFailure(key: string, windowMs: number, now = Date.now()) {
  allow(key, Infinity, windowMs, now);
}
