import { execFileSync } from "node:child_process";

/**
 * Supabase connection settings for the LOCAL stack.
 * Uses env vars when set; otherwise asks the Supabase CLI (`supabase status`), so no keys
 * have to be written to disk. Local-only: these are the CLI's development keys.
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceKey: string;
}

let cached: SupabaseConfig | null = null;

export function supabaseConfig(): SupabaseConfig {
  if (cached) return cached;
  const env = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (env.url && env.anonKey && env.serviceKey) {
    cached = { url: env.url, anonKey: env.anonKey, serviceKey: env.serviceKey };
    return cached;
  }
  let raw: string;
  try {
    raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 30_000,
    });
  } catch {
    throw new Error("Local Supabase is not running. Start it with `npx supabase start`.");
  }
  const s = JSON.parse(raw.slice(raw.indexOf("{"))) as Record<string, string>;
  const url = s.API_URL;
  const anonKey = s.ANON_KEY ?? s.PUBLISHABLE_KEY;
  const serviceKey = s.SERVICE_ROLE_KEY ?? s.SECRET_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error("Could not read local Supabase keys from `supabase status`.");
  cached = { url, anonKey, serviceKey };
  return cached;
}
