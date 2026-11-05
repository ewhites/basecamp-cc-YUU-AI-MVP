"use server";

import { revalidatePath } from "next/cache";
import { runArenaFor, scorePending, submitAttempt, type AttemptView, type StoredOutput, type StudentViewer } from "@/lib/attempts";
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
  payload: { prompt: string; pickedModel: string; reasoning: string; outputs: Extract<StoredOutput, { outputs: unknown }>["outputs"] },
): Promise<Result> {
  if (!payload.reasoning.trim()) return { ok: false, error: "Explain your pick first." };
  if (!payload.outputs?.length) return { ok: false, error: "Run the prompt on the three models first." };
  const v = await student();
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
  try {
    const { scrubPii } = await import("@/lib/coach/privacy");
    const names = v.student ? [{ name: v.student.display_name, replacement: v.student.id }] : [];
    const answer = await askCoach(scrubPii(question, names).text, ex?.module);
    if (answer.distress && v.student) {
      const { adminClient } = await import("@/lib/supabase/admin");
      await adminClient().from("safety_flags").insert({ student_id: v.student.id, kind: "distress", detail: "Distress phrase detected in Ask the coach. Coach skipped; staff contact message shown. Message text not stored." });
    } else if (answer.usage && v.student) {
      const { adminClient } = await import("@/lib/supabase/admin");
      await adminClient().from("usage_ledger").insert({
        student_id: v.student.id,
        purpose: "qa",
        model: answer.model,
        input_tokens: answer.usage.input_tokens,
        output_tokens: answer.usage.output_tokens,
        cache_read_tokens: answer.usage.cache_read_input_tokens ?? 0,
        cache_write_tokens: answer.usage.cache_creation_input_tokens ?? 0,
        cost_usd: answer.costUsd.toFixed(6),
      });
    }
    return { text: answer.text, distress: answer.distress };
  } catch (e) {
    return { error: `The coach is unavailable right now. ${e instanceof Error ? e.message : ""}` };
  }
}
