import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./lib/supabase/config";

/** Keeps the Supabase session cookie fresh on every Lab request (Next 16 proxy, formerly middleware). */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const c = supabaseConfig();
  const supabase = createServerClient(c.url, c.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/lab/:path*", "/api/lab/:path*"],
};
