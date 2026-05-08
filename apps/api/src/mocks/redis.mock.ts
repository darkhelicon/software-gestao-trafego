import type { Redis } from "ioredis";

// In-memory Redis mock — covers the subset of ioredis used by the API
// (quota tracking, rate limiting, caching). Does NOT emulate BullMQ internals.

const store = new Map<string, string>();
const ttls = new Map<string, NodeJS.Timeout>();

function clearTtl(key: string) {
  const t = ttls.get(key);
  if (t) clearTimeout(t);
  ttls.delete(key);
}

function makePipeline(client: typeof mockRedisClient) {
  const results: unknown[] = [];
  const deferred: Array<() => unknown> = [];

  const pipe = {
    get: (key: string) => { deferred.push(() => client.get(key)); return pipe; },
    set: (key: string, val: string) => { deferred.push(() => client.set(key, val)); return pipe; },
    del: (key: string) => { deferred.push(() => client.del(key)); return pipe; },
    incr: (key: string) => { deferred.push(() => client.incr(key)); return pipe; },
    expire: (key: string, sec: number) => { deferred.push(() => client.expire(key, sec)); return pipe; },
    hset: (_key: string, ..._: unknown[]) => { deferred.push(() => 0); return pipe; },
    hget: (_key: string, _field: string) => { deferred.push(() => null); return pipe; },
    exec: async () => {
      for (const fn of deferred) results.push([null, await fn()]);
      return results;
    },
  };
  return pipe;
}

export const mockRedisClient = {
  // ── Core commands ──────────────────────────────────────────────────────────
  get: async (key: string) => store.get(key) ?? null,

  set: async (key: string, value: string, ..._args: unknown[]) => {
    store.set(key, value);
    return "OK";
  },

  setex: async (key: string, seconds: number, value: string) => {
    store.set(key, value);
    clearTtl(key);
    ttls.set(key, setTimeout(() => { store.delete(key); ttls.delete(key); }, seconds * 1000));
    return "OK";
  },

  del: async (...keys: string[]) => {
    let count = 0;
    for (const k of keys) if (store.delete(k)) count++;
    return count;
  },

  incr: async (key: string) => {
    const val = parseInt(store.get(key) ?? "0", 10) + 1;
    store.set(key, String(val));
    return val;
  },

  incrby: async (key: string, by: number) => {
    const val = parseInt(store.get(key) ?? "0", 10) + by;
    store.set(key, String(val));
    return val;
  },

  expire: async (key: string, seconds: number) => {
    if (!store.has(key)) return 0;
    clearTtl(key);
    ttls.set(key, setTimeout(() => { store.delete(key); ttls.delete(key); }, seconds * 1000));
    return 1;
  },

  exists: async (...keys: string[]) => keys.filter((k) => store.has(k)).length,
  keys: async (_pattern: string) => [] as string[],

  hset: async (_key: string, ..._: unknown[]) => 1,
  hget: async (_key: string, _field: string) => null,
  hgetall: async (_key: string) => ({}),
  hdel: async (_key: string, ..._: string[]) => 1,

  llen: async (_key: string) => 0,
  lrange: async (_key: string, _start: number, _stop: number) => [] as string[],

  ping: async () => "PONG",
  quit: async () => "OK",
  disconnect: () => {},

  on: (_event: string, _handler: unknown) => mockRedisClient,
  connect: async () => {},

  // Pipeline — deferred execution
  pipeline: () => makePipeline(mockRedisClient),
  multi: () => makePipeline(mockRedisClient),

  // Needed by BullMQ / quota internals — return safe defaults
  zadd: async (..._: unknown[]) => 0,
  zrange: async (..._: unknown[]) => [] as string[],
  zcard: async (..._: unknown[]) => 0,
  zrem: async (..._: unknown[]) => 0,
  evalsha: async (..._: unknown[]) => null,
  eval: async (..._: unknown[]) => null,
  script: async (..._: unknown[]) => null,
  xadd: async (..._: unknown[]) => null,
  xlen: async (..._: unknown[]) => 0,
} as unknown as Redis;
