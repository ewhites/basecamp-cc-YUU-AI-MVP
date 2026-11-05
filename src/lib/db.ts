import "server-only";
import { cookies } from "next/headers";
import { DemoClient } from "./demo/client";
import { PERSONA_IDS } from "./demo/sample";
import { persona } from "./personas";
import { demoLoginEnabled, verify } from "./demo/secret";

/**
 * Data access for the demo. There is no backend: data lives in an in-memory store
 * (src/lib/demo) with the same access rules as the Postgres RLS policies.
 */

export const SESSION_COOKIE = "lab_session";

/** Service client: trusted server writes only (saving attempts and scores). Never for display reads. */
export function adminClient(): DemoClient {
  return new DemoClient({ kind: "service" });
}

/** The signed-in persona from the signed demo session cookie, or null. */
export async function sessionPersona(): Promise<string | null> {
  // Read cookies first, even when sign-in is off, so every signed-in page renders per request
  // (otherwise the build could prerender it as a static, signed-out page).
  const jar = await cookies();
  if (!demoLoginEnabled()) return null;
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [key, sig] = raw.split(".");
  if (!key || !sig || !verify(key, sig) || !persona(key) || !PERSONA_IDS[key]) return null;
  return key;
}

/** Client acting AS the signed-in user: every read is filtered by the access rules. */
export async function userClient(): Promise<DemoClient> {
  const key = await sessionPersona();
  return new DemoClient(key ? { kind: "user", uid: PERSONA_IDS[key]! } : { kind: "anon" });
}
