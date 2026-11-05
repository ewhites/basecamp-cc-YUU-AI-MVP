import "server-only";
import type { AttemptView } from "./attempts";
import { toAttemptView } from "./attempts";
import { SKILLS, type Skill } from "./curriculum/types";
import { skillLevels, type CheckRow } from "./insights";
import { userClient } from "./supabase/server";

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
