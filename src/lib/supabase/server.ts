import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

/**
 * Supabase client acting AS the signed-in user, so every query is filtered by RLS.
 * Use this for every read the UI shows.
 */
export async function userClient() {
  const store = await cookies();
  const c = supabaseConfig();
  return createServerClient(c.url, c.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there; proxy.ts refreshes them.
        }
      },
    },
  });
}
