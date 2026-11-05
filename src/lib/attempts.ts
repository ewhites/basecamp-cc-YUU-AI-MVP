import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { checkBudget, budgetConfig } from "./coach/budget";
import { CoachUnavailableError, toCoachError } from "./coach/client";
import { detectDistress, DISTRESS_RESPONSE } from "./coach/distress";
import { gradeAttempt, type CheckOutcome, type GradeResult } from "./coach/grade";
import { removedSummary, scrubPii } from "./coach/privacy";
import { arenaOutputsText, runBot, runStudentPrompt, transcriptText, type BotTurn, type RunOutput } from "./coach/runner";
import { getExercise } from "./curriculum/exercises";
import type { AttemptInput, Exercise } from "./curriculum/types";
import type { UsageLike } from "./models";
import type { Viewer } from "./session";
import { adminClient } from "./db";
import { signingSecret } from "./demo/secret";

/**
 * The one write path for student attempts (all three studios).
 * Order matters and mirrors the PRD: distress check -> budget -> strip personal info -> Claude
 * -> verify -> save. Writes use the service role AFTER the caller has verified the session, so a
 * student can never write their own score; reads elsewhere go through RLS.
 */

export type StudentViewer = Viewer & { student: NonNullable<Viewer["student"]> };

export interface AttemptView {
  id: string;
  attemptNo: number;
  status: "scored" | "pending_score" | "needs_review" | "distress";
  passed: number | null;
  total: number | null;
  tip: string | null;
  checks: CheckOutcome[];
  output: StoredOutput;
  message?: string;
  piiRemoved?: string;
  createdAt: string;
}

export type StoredOutput =
  | { text?: string; model?: string; latencyMs?: number; costUsd?: number }
  | { outputs: { model: string; text: string; latencyMs: number; costUsd: number; usage: UsageLike }[] }
  | { transcript: { id: string; from: string; text: string; reply: string }[] };

function db() {
  return adminClient();
}

export async function recordUsage(studentId: string | null, purpose: string, run: { model: string; usage: UsageLike; costUsd: number }) {
  await db().from("usage_ledger").insert({
    student_id: studentId,
    purpose,
    model: run.model,
    input_tokens: run.usage.input_tokens,
    output_tokens: run.usage.output_tokens,
    cache_read_tokens: run.usage.cache_read_input_tokens ?? 0,
    cache_write_tokens: run.usage.cache_creation_input_tokens ?? 0,
    cost_usd: run.costUsd.toFixed(6),
  });
}

async function flag(studentId: string, kind: "distress" | "pii_removed" | "prompt_injection" | "refusal", detail: string) {
  await db().from("safety_flags").insert({ student_id: studentId, kind, detail });
}

export async function budgetFor(studentId: string) {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const [{ data: today }, { data: month }] = await Promise.all([
    db().from("usage_ledger").select("input_tokens, output_tokens").eq("student_id", studentId).gte("created_at", dayStart),
    db().from("usage_ledger").select("cost_usd").gte("created_at", monthStart),
  ]);
  const studentTokensToday = (today ?? []).reduce((n, r) => n + r.input_tokens + r.output_tokens, 0);
  const monthSpendUsd = (month ?? []).reduce((n, r) => n + Number(r.cost_usd), 0);
  return checkBudget({ studentTokensToday, monthSpendUsd, ...budgetConfig() });
}

/** Text the student wrote, per studio (the part that is scrubbed and checked for distress). */
function studentText(input: AttemptInput): string {
  if (input.studio === "prompt") return input.prompt;
  if (input.studio === "arena") return `${input.prompt}\n${input.reasoning}`;
  return input.instructions;
}

function scrubInput(input: AttemptInput, v: StudentViewer): { input: AttemptInput; removed: string } {
  const names = [{ name: v.student.display_name, replacement: v.student.id }];
  const all: Record<string, number> = {};
  const s = (t: string) => {
    const r = scrubPii(t, names);
    for (const [k, n] of Object.entries(r.removed)) all[k] = (all[k] ?? 0) + (n ?? 0);
    return r.text;
  };
  let out: AttemptInput;
  if (input.studio === "prompt") out = { studio: "prompt", prompt: s(input.prompt) };
  else if (input.studio === "arena") out = { ...input, prompt: s(input.prompt), reasoning: s(input.reasoning) };
  else out = { studio: "agent", instructions: s(input.instructions) };
  return { input: out, removed: removedSummary(all) };
}

const INJECTION = /\b(ignore|disregard|forget)\b.{0,40}\b(rubric|instructions|rules|previous)\b|\bmark (everything|all|every check)\b.{0,20}\bpass/i;

interface Scored {
  output: StoredOutput;
  grade: GradeResult;
}

/** Runs the student's work (if needed) and grades it. Throws CoachUnavailableError on API trouble. */
async function runAndGrade(ex: Exercise, input: AttemptInput, studentId: string, existingOutput?: StoredOutput): Promise<Scored> {
  if (input.studio === "prompt") {
    let run: RunOutput | null = null;
    let text = existingOutput && "text" in existingOutput ? existingOutput.text : undefined;
    if (!text) {
      run = await runStudentPrompt(input.prompt, ex);
      await recordUsage(studentId, "run_prompt", run);
      text = run.text;
    }
    const grade = await gradeAttempt({ exercise: ex, attempt: input.prompt, output: text });
    await recordUsage(studentId, "grade", grade);
    return { output: run ? { text, model: run.model, latencyMs: run.latencyMs, costUsd: run.costUsd } : existingOutput!, grade };
  }
  if (input.studio === "arena") {
    const outputs = existingOutput && "outputs" in existingOutput ? existingOutput.outputs : [];
    const runs: RunOutput[] = outputs.map((o) => ({ ...o, stopReason: null }));
    const verdict = `Picked: ${input.pickedModel}\n\n${input.reasoning}`;
    const grade = await gradeAttempt({ exercise: ex, attempt: verdict, output: `Prompt (same for all three):\n${input.prompt}\n\n${arenaOutputsText(runs)}` });
    await recordUsage(studentId, "grade", grade);
    return { output: { outputs }, grade };
  }
  let turns: BotTurn[];
  if (existingOutput && "transcript" in existingOutput && existingOutput.transcript.length) {
    turns = existingOutput.transcript.map((t) => ({
      message: { id: t.id, kind: "normal", from: t.from, text: t.text },
      reply: { model: "", text: t.reply, usage: { input_tokens: 0, output_tokens: 0 }, costUsd: 0, latencyMs: 0, stopReason: null },
    }));
  } else {
    turns = await runBot(input.instructions, ex);
    for (const t of turns) await recordUsage(studentId, "bot", t.reply);
  }
  const grade = await gradeAttempt({ exercise: ex, attempt: input.instructions, output: transcriptText(turns) });
  await recordUsage(studentId, "grade", grade);
  return {
    output: { transcript: turns.map((t) => ({ id: t.message.id, from: t.message.from, text: t.message.text, reply: t.reply.text })) },
    grade,
  };
}

async function nextAttemptNo(studentId: string, exerciseId: string) {
  const { count } = await db().from("attempts").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("exercise_id", exerciseId);
  return (count ?? 0) + 1;
}

async function insertAttempt(row: Record<string, unknown>, checks: CheckOutcome[]) {
  const { data, error } = await db().from("attempts").insert(row).select("id, attempt_no, created_at").single();
  if (error || !data) throw new Error(`Could not save attempt: ${error?.message}`);
  if (checks.length) {
    const { error: e2 } = await db().from("check_results").insert(
      checks.map((c) => ({
        attempt_id: data.id,
        check_key: c.key,
        skill: c.skill,
        pass: c.pass,
        coach_pass: c.coachPass,
        evidence: c.evidence,
        evidence_verified: c.evidenceVerified,
        reason: c.reason,
        needs_review: c.needsReview,
      })),
    );
    if (e2) throw new Error(`Could not save scores: ${e2.message}`);
  }
  return data;
}

/**
 * Submit an attempt. `existingOutput` carries Arena outputs (shown to the student before they
 * write a verdict); Prompt Studio and Agent Builder generate their output here.
 */
export async function submitAttempt(v: StudentViewer, exerciseId: string, rawInput: AttemptInput, existingOutput?: StoredOutput): Promise<AttemptView> {
  const ex = getExercise(exerciseId);
  if (!ex || ex.studio !== rawInput.studio) throw new Error("Unknown exercise");
  const sid = v.student.id;
  const attemptNo = await nextAttemptNo(sid, ex.id);
  const base = { student_id: sid, exercise_id: ex.id, studio: ex.studio, attempt_no: attemptNo };

  // 1. Distress: skip the coach entirely. The message itself is not stored.
  if (detectDistress(studentText(rawInput)).flagged) {
    await flag(sid, "distress", `Distress phrase detected in ${ex.title}. Coach skipped; staff contact message shown. Message text not stored.`);
    const saved = await insertAttempt({ ...base, input: { studio: ex.studio, withheld: true }, status: "distress" }, []);
    return { id: saved.id, attemptNo, status: "distress", passed: null, total: null, tip: null, checks: [], output: {}, message: DISTRESS_RESPONSE, createdAt: saved.created_at };
  }

  // 2. Strip personal info before anything can reach Claude.
  const { input, removed } = scrubInput(rawInput, v);
  if (removed) await flag(sid, "pii_removed", `${removed} removed before the Claude call (${ex.title}).`);
  if (INJECTION.test(studentText(input))) await flag(sid, "prompt_injection", `Attempt on ${ex.title} tried to instruct the grader. Graded as written.`);

  // 3. Budget and spend cap: save and score later rather than call Claude.
  const budget = await budgetFor(sid);
  if (!budget.ok) {
    const saved = await insertAttempt({ ...base, input, output: existingOutput ?? {}, status: "pending_score" }, []);
    return { id: saved.id, attemptNo, status: "pending_score", passed: null, total: null, tip: null, checks: [], output: existingOutput ?? {}, message: budget.message, piiRemoved: removed || undefined, createdAt: saved.created_at };
  }

  // 4. Run + grade. If Claude is unavailable, save the attempt and score it later.
  try {
    const { output, grade } = await runAndGrade(ex, input, sid, existingOutput);
    const status = grade.needsReview ? "needs_review" : "scored";
    const saved = await insertAttempt(
      { ...base, input, output, status, passed: grade.passed, total: grade.total, tip: grade.tip, model: grade.model, prompt_version: grade.promptVersion },
      grade.checks,
    );
    return { id: saved.id, attemptNo, status, passed: grade.passed, total: grade.total, tip: grade.tip, checks: grade.checks, output, piiRemoved: removed || undefined, createdAt: saved.created_at };
  } catch (err) {
    const e = toCoachError(err);
    if (!(e instanceof CoachUnavailableError)) throw err;
    const saved = await insertAttempt({ ...base, input, output: existingOutput ?? {}, status: "pending_score" }, []);
    return {
      id: saved.id,
      attemptNo,
      status: "pending_score",
      passed: null,
      total: null,
      tip: null,
      checks: [],
      output: existingOutput ?? {},
      message: `Your attempt is saved. The coach is unavailable right now (${e.message}), so it will be scored as soon as it's back.`,
      piiRemoved: removed || undefined,
      createdAt: saved.created_at,
    };
  }
}

/** Retries every pending attempt for a student (the "Score pending attempts" action). */
export async function scorePending(v: StudentViewer): Promise<{ scored: number; stillPending: number }> {
  const { data } = await db().from("attempts").select("id, exercise_id, input, output").eq("student_id", v.student.id).eq("status", "pending_score");
  let scored = 0;
  for (const a of data ?? []) {
    const ex = getExercise(a.exercise_id);
    if (!ex) continue;
    const budget = await budgetFor(v.student.id);
    if (!budget.ok) break;
    try {
      const { output, grade } = await runAndGrade(ex, a.input as AttemptInput, v.student.id, a.output as StoredOutput);
      await db().from("check_results").insert(
        grade.checks.map((c) => ({ attempt_id: a.id, check_key: c.key, skill: c.skill, pass: c.pass, coach_pass: c.coachPass, evidence: c.evidence, evidence_verified: c.evidenceVerified, reason: c.reason, needs_review: c.needsReview })),
      );
      await db()
        .from("attempts")
        .update({ output, status: grade.needsReview ? "needs_review" : "scored", passed: grade.passed, total: grade.total, tip: grade.tip, model: grade.model, prompt_version: grade.promptVersion })
        .eq("id", a.id);
      scored++;
    } catch {
      break;
    }
  }
  return { scored, stillPending: (data?.length ?? 0) - scored };
}

type ArenaOutputs = Extract<StoredOutput, { outputs: unknown }>["outputs"];

/** Arena outputs travel through the browser between step 1 and step 2, so the server signs them. */
function arenaSignature(studentId: string, exerciseId: string, prompt: string, outputs: ArenaOutputs): string {
  const secret = signingSecret();
  return createHmac("sha256", secret).update(JSON.stringify([studentId, exerciseId, prompt, outputs])).digest("hex");
}

export function verifyArenaToken(studentId: string, exerciseId: string, prompt: string, outputs: ArenaOutputs, token: string): boolean {
  const expected = Buffer.from(arenaSignature(studentId, exerciseId, prompt, outputs), "hex");
  const given = Buffer.from(/^[0-9a-f]{64}$/.test(token) ? token : "", "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Arena step 1: run the byte-identical prompt on three models and return outputs for the student to judge. */
export async function runArenaFor(v: StudentViewer, exerciseId: string, rawPrompt: string) {
  const ex = getExercise(exerciseId);
  if (!ex || ex.studio !== "arena") throw new Error("Unknown exercise");
  if (detectDistress(rawPrompt).flagged) {
    await flag(v.student.id, "distress", `Distress phrase detected in ${ex.title}. Coach skipped; staff contact message shown. Message text not stored.`);
    return { distress: true as const, message: DISTRESS_RESPONSE };
  }
  const budget = await budgetFor(v.student.id);
  if (!budget.ok) return { error: budget.message };
  const { text: prompt, removed } = scrubPii(rawPrompt, [{ name: v.student.display_name, replacement: v.student.id }]);
  const { runArena } = await import("./coach/runner");
  try {
    const runs = await runArena(prompt, ex);
    for (const r of runs) await recordUsage(v.student.id, "arena", r);
    const outputs: ArenaOutputs = runs.map((r) => ({ model: r.model, text: r.text, latencyMs: r.latencyMs, costUsd: r.costUsd, usage: r.usage }));
    return { prompt, piiRemoved: removedSummary(removed) || undefined, outputs, token: arenaSignature(v.student.id, ex.id, prompt, outputs) };
  } catch (err) {
    return { error: `The models are unavailable right now (${toCoachError(err).message}). Try again in a minute.` };
  }
}

/** Attempt history for the signed-in student on one exercise, read through RLS by the caller's client. */
export function toAttemptView(row: {
  id: string;
  attempt_no: number;
  status: AttemptView["status"];
  passed: number | null;
  total: number | null;
  tip: string | null;
  output: StoredOutput;
  created_at: string;
  check_results?: {
    check_key: string;
    skill: string;
    pass: boolean;
    coach_pass: boolean | null;
    evidence: string;
    evidence_verified: boolean;
    reason: string;
    needs_review: boolean;
  }[];
}): AttemptView {
  const ex = undefined as Exercise | undefined;
  void ex;
  return {
    id: row.id,
    attemptNo: row.attempt_no,
    status: row.status,
    passed: row.passed,
    total: row.total,
    tip: row.tip,
    output: row.output,
    createdAt: row.created_at,
    checks: (row.check_results ?? []).map((c) => ({
      key: c.check_key,
      text: c.check_key,
      skill: c.skill as CheckOutcome["skill"],
      method: c.coach_pass === null ? "code" : "coach",
      pass: c.pass,
      coachPass: c.coach_pass,
      evidence: c.evidence,
      evidenceVerified: c.evidence_verified,
      reason: c.reason,
      needsReview: c.needs_review,
    })),
  };
}
