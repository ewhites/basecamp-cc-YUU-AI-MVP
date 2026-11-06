import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/db";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
