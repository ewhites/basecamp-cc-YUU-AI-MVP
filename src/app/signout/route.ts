import { NextResponse, type NextRequest } from "next/server";
import { userClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const db = await userClient();
  await db.auth.signOut();
  return NextResponse.redirect(new URL("/", req.url));
}
