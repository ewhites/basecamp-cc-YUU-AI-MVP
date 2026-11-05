"use server";

import { revalidatePath } from "next/cache";
import { runGradingEval } from "@/lib/evals/run";
import { getExercise } from "@/lib/curriculum/exercises";
import { requireRole } from "@/lib/session";
import { adminClient } from "@/lib/supabase/admin";
import { userClient } from "@/lib/supabase/server";

const PATH = "/lab/curriculum";

type Simple = { ok: true; message: string } | { ok: false; error: string };

/**
 * Save an edited rubric check as a new DRAFT version. There is no insert policy on rubric_checks
 * by design, so this is the one place the service-role client writes, and only after the role check.
 * Drafts are never graded against until they pass the eval and are published.
 */
export async function createDraftAction(exerciseId: string, key: string, text: string): Promise<Simple> {
  const viewer = await requireRole("curriculum", "admin");
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length < 8) return { ok: false, error: "Write the check as a full yes/no question (at least 8 characters)." };
  if (clean.length > 300) return { ok: false, error: "Keep the check under 300 characters." };
  const ex = getExercise(exerciseId);
  const check = ex?.checks.find((c) => c.key === key);
  if (!ex || !check) return { ok: false, error: "Pick an exercise and a check first." };

  // Read the current versions through the viewer's session (RLS lets curriculum see drafts).
  const db = await userClient();
  const { data: versions, error } = await db.from("rubric_checks").select("version, text, status, skill, method").eq("exercise_id", ex.id).eq("key", key).order("version", { ascending: false });
  if (error) return { ok: false, error: error.message };
  const published = versions?.find((v) => v.status === "published");
  if (published && published.text.trim() === clean) return { ok: false, error: "That is the same as the published text. Change something first." };
  const next = (versions?.[0]?.version ?? 0) + 1;

  const { error: insertError } = await adminClient()
    .from("rubric_checks")
    .insert({
      exercise_id: ex.id,
      key,
      version: next,
      text: clean,
      skill: published?.skill ?? check.skill,
      method: published?.method ?? check.method,
      status: "draft",
      created_by: viewer.userId,
    });
  if (insertError) return { ok: false, error: insertError.message };
  revalidatePath(PATH);
  return { ok: true, message: `Saved as draft v${next}. Run the eval on it before publishing.` };
}

export type DraftEvalResult =
  | { ok: true; runId: string | null; passedGate: boolean; summary: Record<string, unknown>; error?: string }
  | { ok: false; error: string };

/** Run the grading eval (held-out split) with this draft swapped in for the published check. */
export async function runDraftEvalAction(draftId: number): Promise<DraftEvalResult> {
  await requireRole("curriculum", "admin");
  const db = await userClient();
  const { data: d, error } = await db.from("rubric_checks").select("id, exercise_id, key, text, status").eq("id", draftId).single();
  if (error || !d) return { ok: false, error: error?.message ?? "Draft not found." };
  if (d.status !== "draft") return { ok: false, error: "Only drafts can be evaluated here." };
  try {
    const r = await runGradingEval({ draft: { id: d.id, exerciseId: d.exercise_id, key: d.key, text: d.text }, split: "test", reps: 1, trigger: "rubric-editor" });
    revalidatePath(PATH);
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Publish through the database function, which re-checks the role and the passing eval run. */
export async function publishDraftAction(draftId: number): Promise<Simple> {
  await requireRole("curriculum", "admin");
  const db = await userClient();
  const { error } = await db.rpc("publish_rubric_draft", { p_draft: draftId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true, message: "Published. The coach grades against this version from now on." };
}
