"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { INTRO_COOKIE, encodeIntro, parseIntro } from "../intro";

/** Where the last first-visit answer leads. Anything else falls back to the course home. */
const DEST = { check: "/lab/check/start", home: "/lab" } as const;

/** Saves the two first-visit answers in one cookie (no change to the data layer), then opens the chosen start. */
export async function saveIntro(form: FormData) {
  const v = await getViewer();
  if (!v) redirect("/");
  const intro = parseIntro(`${form.get("work") ?? ""}.${form.get("experience") ?? ""}`);
  if (!intro) redirect("/lab/welcome");
  const proto = (await headers()).get("x-forwarded-proto");
  (await cookies()).set(INTRO_COOKIE, encodeIntro(intro), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: proto === "https",
    maxAge: 60 * 60 * 24 * 365,
  });
  const start = form.get("start");
  redirect(start === "check" ? DEST.check : DEST.home);
}
