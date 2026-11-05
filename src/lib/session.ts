import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "./personas";
import { sessionPersona, userClient } from "./db";
import { PERSONA_IDS } from "./demo/sample";

export interface Viewer {
  userId: string;
  role: Role;
  name: string;
  persona: string;
  /** Present for students: their pseudonymous student record (the only ID sent to Claude). */
  student: { id: string; display_name: string; track: string; section_id: string } | null;
}

/** The signed-in user and their role (a user can only read their own profile). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const key = await sessionPersona();
  if (!key) return null;
  const db = await userClient();
  const userId = PERSONA_IDS[key]!;
  const { data: profile } = await db.from("profiles").select("role, display_name, persona").eq("id", userId).single();
  if (!profile) return null;
  let student: Viewer["student"] = null;
  if (profile.role === "student") {
    const { data } = await db.from("students").select("id, display_name, track, section_id").eq("user_id", userId).single();
    student = data ?? null;
  }
  return { userId, role: profile.role, name: profile.display_name, persona: profile.persona, student };
});

/** Page guard: sends signed-out users to the simulated Brightspace course page, wrong roles to their home. */
export async function requireRole(...roles: Role[]): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/");
  if (!roles.includes(v.role)) redirect("/lab");
  return v;
}
