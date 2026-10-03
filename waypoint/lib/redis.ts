// Shared state for running several app instances. Without REDIS_URL everything falls back to in-process memory (single instance).
import Redis from "ioredis";

const g = globalThis as unknown as { __redis?: Redis | null };

export function redis(): Redis | null {
  if (g.__redis === undefined) {
    g.__redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: true }) : null;
    g.__redis?.on("error", (e) => console.error("redis:", e.message));
  }
  return g.__redis;
}

/** Atomically: return the existing value and slide its TTL, or store `value` with the TTL and return it. */
const GET_OR_SET = `local v = redis.call('GET', KEYS[1])
if v then redis.call('PEXPIRE', KEYS[1], ARGV[2]) return v end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]) return ARGV[1]`;

/** Atomically increment a counter, starting its TTL on first use. */
const INCR_TTL = `local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return n`;

export async function getOrSet(r: Redis, key: string, value: string, ttlMs: number): Promise<string> {
  return (await r.eval(GET_OR_SET, 1, key, value, ttlMs)) as string;
}
export async function incrWithTtl(r: Redis, key: string, ttlMs: number): Promise<number> {
  return Number(await r.eval(INCR_TTL, 1, key, ttlMs));
}
