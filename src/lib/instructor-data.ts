import "server-only";
import { EXERCISES, getExercise } from "./curriculum/exercises";
import { SKILLS, type RubricCheck, type Skill } from "./curriculum/types";
import { hardestChecks, skillLevels, stuckStudents, type CheckRow, type Flag, type SkillLevel } from "./insights";
import { userClient } from "./db";

/**
 * Reads for the instructor console. Every query goes through userClient(), so RLS decides which
 * sections, students, attempts and flags the instructor can see. Nothing here filters by role.
 */

export interface Section {
  id: string;
  name: string;
  cycle: string;
}

export interface StudentRow {
  id: string;
  display_name: string;
  track: string;
}

const PAGE = 1000;

/** Sections the signed-in instructor teaches (RLS: own rows of section_instructors only). */
export async function mySections(): Promise<Section[]> {
  const db = await userClient();
  const { data, error } = await db.from("section_instructors").select("section_id, sections(id, name, cycle)").order("section_id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { section_id: string; sections: Section | null }[]).map(
    (r) => r.sections ?? { id: r.section_id, name: `Section ${r.section_id}`, cycle: "" },
  );
}

export async function sectionStudents(sectionId: string): Promise<StudentRow[]> {
  const db = await userClient();
  const { data, error } = await db.from("students").select("id, display_name, track").eq("section_id", sectionId).order("id");
  if (error) throw new Error(error.message);
  return (data ?? []) as StudentRow[];
}

type RawCheck = { attempt_id: string; check_key: string; skill: Skill; pass: boolean; attempts: { student_id: string; created_at: string } };

/** All check results for these students, paged 1,000 rows at a time (PostgREST caps each response). */
export async function checkRowsFor(studentIds: string[]): Promise<CheckRow[]> {
  if (!studentIds.length) return [];
  const db = await userClient();
  const page = (from: number) =>
    db
      .from("check_results")
      .select("attempt_id, check_key, skill, pass, attempts!inner(student_id, created_at)", { count: from === 0 ? "exact" : undefined })
      .in("attempts.student_id", studentIds)
      .order("attempt_id")
      .order("check_key")
      .range(from, from + PAGE - 1);
  const first = await page(0);
  if (first.error) throw new Error(first.error.message);
  const raw: RawCheck[] = [...((first.data ?? []) as unknown as RawCheck[])];
  const total = first.count ?? raw.length;
  const rest = [];
  for (let from = PAGE; from < total; from += PAGE) rest.push(page(from));
  for (const r of await Promise.all(rest)) {
    if (r.error) throw new Error(r.error.message);
    raw.push(...((r.data ?? []) as unknown as RawCheck[]));
  }
  return raw.map((r) => ({
    attempt_id: r.attempt_id,
    check_key: r.check_key,
    skill: r.skill,
    pass: r.pass,
    student_id: r.attempts.student_id,
    created_at: r.attempts.created_at,
  }));
}

/** Heat class for a pass rate: heat-0 (<40%) up to heat-4 (85% or more). */
export function heatClass(x: number | null): string {
  if (x === null) return "heat-na";
  if (x < 0.4) return "heat-0";
  if (x < 0.55) return "heat-1";
  if (x < 0.7) return "heat-2";
  if (x < 0.85) return "heat-3";
  return "heat-4";
}

function avg(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function firstAndNow(lv: Record<Skill, SkillLevel> | undefined): { first: number | null; now: number | null } {
  if (!lv) return { first: null, now: null };
  return { first: avg(SKILLS.map((s) => lv[s].first)), now: avg(SKILLS.map((s) => lv[s].current)) };
}

function findCheck(key: string, skill: string): RubricCheck | undefined {
  for (const ex of EXERCISES) {
    const c = ex.checks.find((k) => k.key === key && k.skill === skill);
    if (c) return c;
  }
  return undefined;
}

export interface MiniLesson {
  skill: Skill;
  students: number;
  check: { key: string; text: string; miniLesson: string; rate: number; n: number };
}

/** For the skill with the most stuck students: the check those students fail most, and its mini-lesson. */
export function suggestMiniLesson(rows: CheckRow[], flags: Flag[]): MiniLesson | null {
  if (!flags.length) return null;
  const bySkill = new Map<Skill, Set<string>>();
  for (const f of flags) bySkill.set(f.skill, (bySkill.get(f.skill) ?? new Set()).add(f.student_id));
  const [skill, students] = [...bySkill.entries()].sort((a, b) => b[1].size - a[1].size)[0]!;
  const hard = hardestChecks(rows.filter((r) => r.skill === skill && students.has(r.student_id)), 10);
  for (const h of hard) {
    const c = findCheck(h.key, h.skill);
    if (c) return { skill, students: students.size, check: { key: c.key, text: c.text, miniLesson: c.miniLesson, rate: h.rate, n: h.n } };
  }
  return null;
}

export interface SectionOverview {
  students: StudentRow[];
  levels: Map<string, Record<Skill, SkillLevel>>;
  flags: Flag[];
  miniLesson: MiniLesson | null;
}

export async function sectionOverview(sectionId: string): Promise<SectionOverview> {
  const students = await sectionStudents(sectionId);
  const rows = await checkRowsFor(students.map((s) => s.id));
  const levels = skillLevels(rows);
  const flags = stuckStudents(levels);
  return { students, levels, flags, miniLesson: suggestMiniLesson(rows, flags) };
}

export interface SafetyFlagRow {
  id: number;
  student_id: string;
  kind: string;
  detail: string;
  created_at: string;
}

/** Open safety flags for these students. Only the `detail` summary is read, never raw student text. */
export async function openSafetyFlags(studentIds: string[]): Promise<SafetyFlagRow[]> {
  if (!studentIds.length) return [];
  const db = await userClient();
  const { data, error } = await db
    .from("safety_flags")
    .select("id, student_id, kind, detail, created_at")
    .eq("status", "open")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SafetyFlagRow[];
}

export interface AttemptListRow {
  id: string;
  student_id: string;
  exercise_id: string;
  attempt_no: number;
  status: string;
  passed: number | null;
  total: number | null;
  released_at: string | null;
  created_at: string;
}

const LIST_COLS = "id, student_id, exercise_id, attempt_no, status, passed, total, released_at, created_at";

export async function needsReviewAttempts(studentIds: string[]): Promise<AttemptListRow[]> {
  if (!studentIds.length) return [];
  const db = await userClient();
  const { data, error } = await db
    .from("attempts")
    .select(LIST_COLS)
    .eq("status", "needs_review")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttemptListRow[];
}

export async function studentAttempts(studentId: string): Promise<AttemptListRow[]> {
  const db = await userClient();
  const { data, error } = await db.from("attempts").select(LIST_COLS).eq("student_id", studentId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttemptListRow[];
}

export interface CheckResultRow {
  check_key: string;
  skill: string;
  pass: boolean;
  coach_pass: boolean | null;
  evidence: string;
  evidence_verified: boolean;
  reason: string;
  needs_review: boolean;
  overridden: boolean;
  override_note: string | null;
}

export interface AttemptReplay extends AttemptListRow {
  studio: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  tip: string | null;
  model: string | null;
  check_results: CheckResultRow[];
}

/**
 * One attempt for replay. Logs the staff view first (audit_log via log_attempt_view, which also
 * refuses attempts outside the instructor's sections), then reads it through RLS.
 */
export async function attemptReplay(attemptId: string): Promise<AttemptReplay | null> {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return null;
  const db = await userClient();
  const { error: logError } = await db.rpc("log_attempt_view", { p_attempt: attemptId });
  if (logError) return null;
  const { data, error } = await db
    .from("attempts")
    .select(
      `${LIST_COLS}, studio, input, output, tip, model, check_results(check_key, skill, pass, coach_pass, evidence, evidence_verified, reason, needs_review, overridden, override_note)`,
    )
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AttemptReplay | null) ?? null;
}

export function exerciseTitle(id: string): string {
  return getExercise(id)?.title ?? id;
}
