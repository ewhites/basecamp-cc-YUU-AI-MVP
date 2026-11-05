import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/db";
import { demoLoginEnabled, sign } from "@/lib/demo/secret";
import { persona } from "@/lib/personas";

/**
 * SIMULATED Brightspace launch + Year Up sign-in. In the pilot this becomes an LTI 1.3 launch
 * from the course link with Year Up (Azure) single sign-on that verifies Brightspace's signed
 * id_token. Here it sets a signed session cookie for a seeded sample persona.
 */
export async function GET(req: NextRequest) {
  if (!demoLoginEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = persona(req.nextUrl.searchParams.get("as") ?? "");
  if (!p) return NextResponse.redirect(new URL("/", req.url));

  const next = req.nextUrl.searchParams.get("next");
  const res = NextResponse.redirect(new URL(next && /^\/(lab|home)(\/|$)/.test(next) ? next : p.landing, req.url));
  res.cookies.set(SESSION_COOKIE, `${p.key}.${sign(p.key)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
