import { randomUUID } from "node:crypto";
import { applyChanges, type Change, type Store } from "./store";

/**
 * Keeps every server's in-memory demo store in step, so a student's progress survives when
 * Vercel routes their next click to a different server instance.
 *
 * Every server seeds the same deterministic sample data. Each data change made after seeding is
 * appended to one shared, append-only log in Upstash Redis (free plan, Vercel Marketplace), and
 * every server replays new log entries before it reads. The access rules are untouched: they run
 * on each server's local copy, exactly as before.
 *
 * With no Redis configured (local dev, unit tests, the MCP server) this is a no-op.
 * The log key includes the seed version, so changing the seed starts a fresh log.
 */

/** Bump with the seed (instance.ts) so a new seed never replays changes made against an old one. */
export const SEED_VERSION = 5;
const KEY = `yuu-ai-lab:changes:v${SEED_VERSION}`;
const PAGE = 200;
/** Within one burst of queries (one page render), sync once. */
const FRESH_MS = 40;
const TIMEOUT_MS = 2500;

function config(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function syncEnabled(): boolean {
  return config() !== null;
}

/** Upstash REST pipeline: one HTTPS request, several Redis commands. */
async function redis(commands: (string | number)[][]): Promise<unknown[]> {
  const c = config()!;
  const res = await fetch(`${c.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`shared store: HTTP ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  const err = out.find((r) => r.error);
  if (err) throw new Error(`shared store: ${err.error}`);
  return out.map((r) => r.result);
}

interface SyncState {
  /** Log entries already applied here (our own included). */
  applied: number;
  lastPull: number;
  inflight: Promise<void> | null;
  /** Entries this server wrote, so it doesn't apply them twice. */
  own: Set<string>;
  /** Writes are pushed one at a time, in order. */
  pushing: Promise<void>;
}

const states = new WeakMap<Store, SyncState>();
function stateOf(s: Store): SyncState {
  let st = states.get(s);
  if (!st) states.set(s, (st = { applied: 0, lastPull: 0, inflight: null, own: new Set(), pushing: Promise.resolve() }));
  return st;
}

/** Apply every change other servers have logged since we last looked. */
export async function pullChanges(s: Store): Promise<void> {
  if (!syncEnabled()) return;
  const st = stateOf(s);
  if (st.inflight) return st.inflight;
  if (Date.now() - st.lastPull < FRESH_MS) return;
  st.inflight = (async () => {
    try {
      for (;;) {
        const [entries] = (await redis([["LRANGE", KEY, st.applied, st.applied + PAGE - 1]])) as string[][];
        for (const raw of entries ?? []) {
          const e = JSON.parse(raw) as { id: string; changes: Change[] };
          if (st.own.has(e.id)) st.own.delete(e.id);
          else applyChanges(s, e.changes);
          st.applied++;
        }
        if (!entries || entries.length < PAGE) break;
      }
      st.lastPull = Date.now();
    } catch (err) {
      // The demo keeps working on this server's copy if the shared store is unreachable.
      console.error("[demo sync] pull failed:", err instanceof Error ? err.message : err);
    } finally {
      st.inflight = null;
    }
  })();
  return st.inflight;
}

/** Share this server's new changes. Awaited before the response, so the next click sees them anywhere. */
export async function pushChanges(s: Store): Promise<void> {
  if (!s.journal.length) return;
  const changes = s.journal.splice(0);
  if (!syncEnabled()) return;
  const st = stateOf(s);
  const id = randomUUID();
  st.own.add(id);
  st.pushing = st.pushing.then(async () => {
    try {
      await redis([["RPUSH", KEY, JSON.stringify({ id, changes })]]);
    } catch (err) {
      st.own.delete(id);
      console.error("[demo sync] push failed:", err instanceof Error ? err.message : err);
    }
  });
  return st.pushing;
}
