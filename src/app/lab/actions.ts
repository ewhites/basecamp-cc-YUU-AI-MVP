"use server";

import { revalidatePath } from "next/cache";
import { budgetFor, recordUsage, runArenaFor, scorePending, submitAttempt, verifyArenaToken, type AttemptView, type StoredOutput, type StudentViewer } from "@/lib/attempts";
import { budgetConfig, checkBudget } from "@/lib/coach/budget";
import { adminClient } from "@/lib/db";
import { askCoach } from "@/lib/coach/qa";
import { getExercise } from "@/lib/curriculum/exercises";
import { getViewer } from "@/lib/session";
import { STUDIO_PATHS } from "@/lib/personas";

/** Student server actions for all three studios. Every one re-checks the session first. */

async function student(): Promise<StudentViewer> {
  const v = await getViewer();
  if (!v || v.role !== "student" || !v.student) throw new Error("Only students can submit attempts.");
  return v as StudentViewer;
}

type Result = { ok: true; attempt: AttemptView } | { ok: false; error: string };

async function guard(fn: () => Promise<AttemptView>, path: string): Promise<Result> {
  try {
    const attempt = await fn();
    revalidatePath(path);
    revalidatePath("/lab");
    return { ok: true, attempt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function submitPromptAction(exerciseId: string, prompt: string): Promise<Result> {
  if (!prompt.trim()) return { ok: false, error: "Write a prompt first." };
  if (prompt.length > 6000) return { ok: false, error: "That prompt is too long for this exercise (6,000 characters max)." };
  const v = await student();
  return guard(() => submitAttempt(v, exerciseId, { studio: "prompt", prompt }), STUDIO_PATHS.prompt);
}

export async function runArenaAction(exerciseId: string, prompt: string) {
  if (!prompt.trim()) return { error: "Write a prompt first." };
  if (prompt.length > 6000) return { error: "That prompt is too long (6,000 characters max)." };
  const v = await student();
  return runArenaFor(v, exerciseId, prompt);
}

export async function submitArenaAction(
  exerciseId: string,
  payload: { prompt: string; pickedModel: string; reasoning: string; outputs: Extract<StoredOutput, { outputs: unknown }>["outputs"]; token: string },
): Promise<Result> {
  if (!payload.reasoning.trim()) return { ok: false, error: "Explain your pick first." };
  if (payload.reasoning.length > 4000) return { ok: false, error: "Keep your reasoning under 4,000 characters." };
  if (!payload.outputs?.length) return { ok: false, error: "Run the prompt on the three models first." };
  const v = await student();
  // The outputs came back through the browser: only accept exactly what the server produced and signed.
  if (!verifyArenaToken(v.student.id, exerciseId, payload.prompt, payload.outputs, payload.token ?? "")) {
    return { ok: false, error: "These results couldn't be verified. Run the prompt on the three models again." };
  }
  if (!payload.outputs.some((o) => o.model === payload.pickedModel)) return { ok: false, error: "Pick one of the three models that ran." };
  return guard(
    () => submitAttempt(v, exerciseId, { studio: "arena", prompt: payload.prompt, pickedModel: payload.pickedModel, reasoning: payload.reasoning }, { outputs: payload.outputs }),
    STUDIO_PATHS.arena,
  );
}

export async function submitAgentAction(exerciseId: string, instructions: string): Promise<Result> {
  if (!instructions.trim()) return { ok: false, error: "Write the bot's instructions first." };
  if (instructions.length > 6000) return { ok: false, error: "Instructions are too long (6,000 characters max)." };
  const v = await student();
  return guard(() => submitAttempt(v, exerciseId, { studio: "agent", instructions }), STUDIO_PATHS.agent);
}

export async function scorePendingAction() {
  const v = await student();
  const r = await scorePending(v);
  revalidatePath("/lab", "layout");
  return r;
}

export async function askLessonCoachAction(exerciseId: string, question: string) {
  const v = await getViewer();
  if (!v) return { error: "Sign in first." };
  if (!question.trim()) return { error: "Ask a question about this lesson." };
  if (question.length > 1500) return { error: "Keep questions under 1,500 characters." };
  const ex = getExercise(exerciseId);
  // Same spend guards as attempts: a student's daily budget, and the Lab-wide monthly cap for everyone.
  if (v.student) {
    const b = await budgetFor(v.student.id);
    if (!b.ok) return { error: b.message };
  } else {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data } = await adminClient().from("usage_ledger").select("cost_usd").gte("created_at", monthStart);
    const spend = (data ?? []).reduce((n, r) => n + Number(r.cost_usd), 0);
    const b = checkBudget({ studentTokensToday: 0, monthSpendUsd: spend, ...budgetConfig() });
    if (!b.ok) return { error: b.message };
  }
  try {
    const { scrubPii } = await import("@/lib/coach/privacy");
    const names = v.student ? [{ name: v.student.display_name, replacement: v.student.id }] : [];
    const answer = await askCoach(scrubPii(question, names).text, ex?.module);
    if (answer.distress && v.student) {
      await adminClient().from("safety_flags").insert({ student_id: v.student.id, kind: "distress", detail: "Distress phrase detected in Ask the coach. Coach skipped; staff contact message shown. Message text not stored." });
    } else if (answer.usage) {
      await recordUsage(v.student?.id ?? null, "qa", { model: answer.model, usage: answer.usage, costUsd: answer.costUsd });
    }
    return { text: answer.text, distress: answer.distress };
  } catch (e) {
    return { error: `The coach is unavailable right now. ${e instanceof Error ? e.message : ""}` };
  }
}
