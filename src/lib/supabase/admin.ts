import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

/**
 * Service-role client. Bypasses RLS, so it is used ONLY for trusted server writes
 * (saving attempts and coach scores after the session is verified), the seeder,
 * and minting sign-in tokens for the simulated Brightspace launch.
 * Never use it to read data for display: reads go through the user's own session.
 */
let admin: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (!admin) {
    const c = supabaseConfig();
    admin = createClient(c.url, c.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

/** Signs in as a seeded persona without any stored password: mint a one-time token, then verify it. */
export async function personaSession(email: string, anon: SupabaseClient) {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(`Could not mint a sign-in token: ${error?.message ?? "no token"}`);
  const { data: s, error: e2 } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (e2 || !s.session) throw new Error(`Sign-in failed: ${e2?.message ?? "no session"}`);
  return s.session;
}
