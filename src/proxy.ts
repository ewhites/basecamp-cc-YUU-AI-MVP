import { NextResponse, type NextRequest } from "next/server";
import { demoLoginEnabled, SESSION_COOKIE, verify } from "@/lib/demo/secret";
import { persona } from "@/lib/personas";

/**
 * The admin cost view is admin-only: for anyone else it does not exist (404), as before it was built.
 * This check runs before the page renders, because the lab's loading screen starts streaming a page
 * before a notFound() inside it could set the status. The page and the data layer check the role again.
 */
export function proxy(req: NextRequest) {
  const [key, sig] = (req.cookies.get(SESSION_COOKIE)?.value ?? "").split(".");
  const admin = demoLoginEnabled() && !!key && !!sig && verify(key, sig) && persona(key)?.role === "admin";
  if (admin) return NextResponse.next();
  return NextResponse.rewrite(new URL("/__not-found", req.url));
}

export const config = { matcher: ["/lab/admin", "/lab/admin/:path*"] };
