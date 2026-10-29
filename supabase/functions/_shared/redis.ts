// supabase/functions/_shared/redis.ts
// Minimal Upstash Redis REST client for edge functions.
// - Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from Supabase secrets.
// - Every call fails open: if Redis is not configured, slow or down, it returns
//   null/false and the caller carries on as if there were no cache.

const URL_ = Deno.env.get("UPSTASH_REDIS_REST_URL") ?? "";
const TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") ?? "";
const TIMEOUT_MS = 600;

export const redisEnabled = Boolean(URL_ && TOKEN);

async function command(args: (string | number)[]): Promise<unknown> {
  if (!redisEnabled) return null;
  try {
    const res = await fetch(URL_, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch (err) {
    console.warn("[redis]", args[0], "failed:", (err as Error).message);
    return null;
  }
}

/** Cached value wrapper: `t` is when the data was produced (ms epoch). */
export interface Stamped<T> { t: number; data: T }

export async function getJSON<T>(key: string): Promise<Stamped<T> | null> {
  const raw = await command(["GET", key]);
  if (typeof raw !== "string") return null;
  try { return JSON.parse(raw) as Stamped<T>; } catch { return null; }
}

/** Store `data` stamped with now; `ttlSec` is how long Redis keeps it at all. */
export async function setJSON<T>(key: string, data: T, ttlSec: number): Promise<boolean> {
  const value: Stamped<T> = { t: Date.now(), data };
  return (await command(["SET", key, JSON.stringify(value), "EX", ttlSec])) === "OK";
}

/** Short-lived lock so only one request refreshes a stale key at a time. */
export async function tryLock(key: string, ttlSec: number): Promise<boolean> {
  if (!redisEnabled) return true;
  return (await command(["SET", `lock:${key}`, "1", "NX", "EX", ttlSec])) === "OK";
}

export async function del(...keys: string[]): Promise<void> {
  if (keys.length) await command(["DEL", ...keys]);
}

/** Run work after the response is sent (Supabase EdgeRuntime), else just start it. */
export function background(p: Promise<unknown>): void {
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
  else p.catch(() => {});
}
