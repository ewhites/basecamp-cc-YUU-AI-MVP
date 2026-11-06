import "server-only";
import type { AttemptView } from "./attempts";
import { toAttemptView } from "./attempts";
import { SKILL_CHECKS, skillCheck } from "./curriculum/skill-checks";
import { SKILLS, type Skill } from "./curriculum/types";
import { isSkillCheck, skillLevels, type CheckRow } from "./insights";
import { findCheck, plainGuidance } from "./instructor-data";
import { userClient } from "./db";
import { scoreChecks, type SkillScores } from "./progress";

/** Reads for the signed-in student. All through RLS: a student can only ever get their own rows. */

export async function myAttempts(exerciseId?: string): Promise<(AttemptView & { exerciseId: string })[]> {
  const db = await userClient();
  let q = db
    .from("attempts")
    .select("id, exercise_id, attempt_no, status, passed, total, tip, output, created_at, input, check_results(check_key, skill, pass, coach_pass, evidence, evidence_verified, reason, needs_review, overridden, override_note)")
    .order("created_at", { ascending: false });
  if (exerciseId) q = q.eq("exercise_id", exerciseId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...toAttemptView(r as never), exerciseId: r.exercise_id, input: r.input }));
}

export async function mySkillProfile(): Promise<{ levels: Record<Skill, { current: number | null; first: number | null }>; attempts: number; streakDays: number }> {
  const db = await userClient();
  const { data } = await db.from("check_results").select("attempt_id, check_key, skill, pass, attempts!inner(student_id, created_at)");
  const rows: CheckRow[] = ((data ?? []) as unknown as { attempt_id: string; check_key: string; skill: Skill; pass: boolean; attempts: { student_id: string; created_at: string } }[]).map((r) => ({
    attempt_id: r.attempt_id,
    check_key: r.check_key,
    skill: r.skill,
    pass: r.pass,
    student_id: r.attempts.student_id,
    created_at: r.attempts.created_at,
  }));
  const lv = [...skillLevels(rows).values()][0];
  const levels = Object.fromEntries(SKILLS.map((s) => [s, { current: lv?.[s].current ?? null, first: lv?.[s].first ?? null }])) as Record<Skill, { current: number | null; first: number | null }>;
  const days = [...new Set(rows.map((r) => r.created_at.slice(0, 10)))].sort().reverse();
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 60; i++) {
    const key = new Date(d.getTime() - i * 86400000).toISOString().slice(0, 10);
    if (days.includes(key)) streak++;
    else if (i > 0) break;
  }
  return { levels, attempts: new Set(rows.map((r) => r.attempt_id)).size, streakDays: streak };
}

/** The latest answer to one task in the starting point or final check. */
export type CheckAnswer = AttemptView & { exerciseId: string; answer: string | null };

type ScoredLike = { exerciseId: string; attemptNo: number; checks: { skill: string; pass: boolean }[] };

/**
 * Per-skill share of checks met on one skills check, from the latest SCORED answer to each task.
 * Answering a task again replaces its earlier score instead of averaging with it.
 * Pending and distress answers have no checks, so they leave the skill "not taken".
 */
export function checkScoresFrom(attempts: ScoredLike[], kind: "start" | "final"): SkillScores {
  const rows: { exercise_id: string; skill: string; pass: boolean }[] = [];
  for (const t of skillCheck(kind)) {
    const latest = attempts
      .filter((a) => a.exerciseId === t.id && a.checks.length > 0)
      .sort((a, b) => b.attemptNo - a.attemptNo)[0];
    for (const c of latest?.checks ?? []) rows.push({ exercise_id: t.id, skill: c.skill, pass: c.pass });
  }
  return scoreChecks(rows, kind);
}

/** The signed-in student's skills checks: the latest answer per task, and per-skill scores for both checks. */
export async function myCheckAnswers(): Promise<{ latest: Record<string, CheckAnswer>; start: SkillScores; final: SkillScores }> {
  const ids = new Set(SKILL_CHECKS.map((e) => e.id));
  const all = (await myAttempts()).filter((a) => ids.has(a.exerciseId));
  const latest: Record<string, CheckAnswer> = {};
  for (const a of all) {
    const cur = latest[a.exerciseId];
    if (cur && cur.attemptNo >= a.attemptNo) continue;
    const input = (a as { input?: unknown }).input;
    const answer = typeof input === "object" && input && "answer" in input ? String((input as { answer: unknown }).answer ?? "") : null;
    latest[a.exerciseId] = { ...a, answer };
  }
  return { latest, start: checkScoresFrom(all, "start"), final: checkScoresFrom(all, "final") };
}

/**
 * The one thing to work on next: the practice check the student missed most across their last
 * 5 practice tries, when they missed it at least twice. Null when nothing stands out.
 */
export async function myFocus(): Promise<{ check: string; looksLike: string; missed: number; tries: number; exerciseId: string } | null> {
  const db = await userClient();
  const { data } = await db.from("check_results").select("attempt_id, check_key, skill, pass, attempts!inner(exercise_id, created_at)");
  const rows = ((data ?? []) as unknown as { attempt_id: string; check_key: string; skill: string; pass: boolean; attempts: { exercise_id: string; created_at: string } }[])
    .filter((r) => !isSkillCheck(r.attempts.exercise_id));
  const recent = [...new Map(rows.map((r) => [r.attempt_id, r.attempts.created_at])).entries()].sort((a, b) => b[1].localeCompare(a[1])).slice(0, 5).map(([id]) => id);
  const agg = new Map<string, { missed: number; tries: number; skill: string; exerciseId: string; at: string }>();
  for (const r of rows.filter((x) => recent.includes(x.attempt_id))) {
    const a = agg.get(r.check_key) ?? { missed: 0, tries: 0, skill: r.skill, exerciseId: r.attempts.exercise_id, at: "" };
    a.tries++;
    if (!r.pass) a.missed++;
    if (r.attempts.created_at > a.at) Object.assign(a, { at: r.attempts.created_at, exerciseId: r.attempts.exercise_id });
    agg.set(r.check_key, a);
  }
  const [key, worst] = [...agg.entries()].filter(([, a]) => a.missed >= 2 && a.missed / a.tries >= 0.5).sort((x, y) => y[1].missed - x[1].missed)[0] ?? [];
  if (!key || !worst) return null;
  const check = findCheck(key, worst.skill);
  if (!check) return null;
  return { check: check.text.replace(/\?$/, ""), looksLike: plainGuidance(check.guidance), missed: worst.missed, tries: worst.tries, exerciseId: worst.exerciseId };
}
