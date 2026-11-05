"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { userClient } from "@/lib/supabase/server";

/**
 * Instructor actions. Each re-checks the role, then calls a Postgres function through the
 * user's own session, so the database re-checks section access and writes the audit log.
 */

export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

export async function overrideCheckAction(attemptId: string, checkKey: string, pass: boolean, note: string): Promise<ActionResult> {
  await requireRole("instructor");
  const trimmed = note.trim();
  if (!trimmed) return { ok: false, error: "Add a short note saying why you changed this score." };
  if (trimmed.length > 500) return { ok: false, error: "Keep the note under 500 characters." };
  const db = await userClient();
  const { error } = await db.rpc("override_check", { p_attempt: attemptId, p_key: checkKey, p_pass: pass, p_note: trimmed });
  if (error) return { ok: false, error: error.code === "42501" ? "You can only change scores for students in your sections." : error.message };
  revalidatePath("/lab/instructor");
  return { ok: true, value: undefined };
}

export async function releaseScoresAction(sectionId: string): Promise<ActionResult<number>> {
  await requireRole("instructor");
  const db = await userClient();
  const { data, error } = await db.rpc("release_scores", { p_section: sectionId });
  if (error) return { ok: false, error: error.code === "42501" ? "You can only send scores for your own sections." : error.message };
  revalidatePath("/lab/instructor");
  return { ok: true, value: Number(data ?? 0) };
}
