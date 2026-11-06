"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { userClient } from "@/lib/db";

/**
 * Instructor actions. Each re-checks the role, then calls a Postgres function through the
 * user's own session, so the database re-checks section access and writes the audit log.
 */

export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

export async function overrideCheckAction(attemptId: string, checkKey: string, pass: boolean, note: string): Promise<ActionResult> {
  await requireRole("instructor");
  if (typeof attemptId !== "string" || !/^[0-9a-f-]{36}$/i.test(attemptId)) return { ok: false, error: "That attempt is not available." };
  if (typeof checkKey !== "string" || !/^[a-z0-9_]{1,64}$/.test(checkKey)) return { ok: false, error: "That check is not available." };
  if (typeof note !== "string") return { ok: false, error: "Add a short note saying why you changed this score." };
  const trimmed = note.trim();
  if (!trimmed) return { ok: false, error: "Add a short note saying why you changed this score." };
  if (trimmed.length > 500) return { ok: false, error: "Keep the note under 500 characters." };
  const db = await userClient();
  const { error } = await db.rpc("override_check", { p_attempt: attemptId, p_key: checkKey, p_pass: pass === true, p_note: trimmed });
  if (error) return { ok: false, error: error.code === "42501" ? "You can only change scores for students in your sections." : error.message };
  revalidatePath("/lab/instructor", "layout");
  return { ok: true, value: undefined };
}

export async function releaseScoresAction(sectionId: string): Promise<ActionResult<number>> {
  await requireRole("instructor");
  if (typeof sectionId !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(sectionId)) return { ok: false, error: "You can only send scores for your own sections." };
  const db = await userClient();
  const { data, error } = await db.rpc("release_scores", { p_section: sectionId });
  if (error) return { ok: false, error: error.code === "42501" ? "You can only send scores for your own sections." : error.message };
  revalidatePath("/lab/instructor", "layout");
  return { ok: true, value: Number(data ?? 0) };
}

export async function resolveFlagAction(flagId: number, note: string): Promise<ActionResult> {
  await requireRole("instructor");
  if (!Number.isSafeInteger(flagId) || flagId < 0) return { ok: false, error: "That flag is not available." };
  const trimmed = typeof note === "string" ? note.trim() : "";
  if (!trimmed) return { ok: false, error: "Add a short note, for example when you checked in." };
  if (trimmed.length > 500) return { ok: false, error: "Keep the note under 500 characters." };
  const db = await userClient();
  const { error } = await db.rpc("resolve_safety_flag", { p_flag: flagId, p_note: trimmed });
  if (error) return { ok: false, error: error.code === "42501" ? "You can only close flags for students in your sections." : error.message };
  revalidatePath("/lab/instructor", "layout");
  return { ok: true, value: undefined };
}
