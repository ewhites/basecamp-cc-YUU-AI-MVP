import { NextResponse, type NextRequest } from "next/server";
import { persona } from "@/lib/personas";
import { adminClient } from "@/lib/supabase/admin";
import { userClient } from "@/lib/supabase/server";

/**
 * SIMULATED Brightspace launch + Year Up sign-in. In the pilot this becomes an LTI 1.3 launch
 * from the course link with Year Up (Azure) single sign-on. Here it mints a one-time token for a
 * seeded sample persona and exchanges it for a session cookie. No passwords exist anywhere.
 */
export async function GET(req: NextRequest) {
  const p = persona(req.nextUrl.searchParams.get("as") ?? "");
  if (!p) return NextResponse.redirect(new URL("/", req.url));

  const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email: p.email });
  if (error || !data.properties?.hashed_token) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent("Run `npm run db:reset` to create the sample accounts.")}`, req.url));
  }
  const db = await userClient();
  await db.auth.signOut();
  const { error: e2 } = await db.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (e2) return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(e2.message)}`, req.url));

  const next = req.nextUrl.searchParams.get("next");
  return NextResponse.redirect(new URL(next && next.startsWith("/lab") ? next : p.landing, req.url));
}
