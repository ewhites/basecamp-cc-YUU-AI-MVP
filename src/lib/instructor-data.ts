import "server-only";
import { EXERCISES, getExercise } from "./curriculum/exercises";
import { SKILL_LABELS, SKILLS, type RubricCheck, type Skill } from "./curriculum/types";
import {
  CLASS_WIDE_MIN,
  hardestChecks,
  isSkillCheck,
  practiceOnly,
  skillLevels,
  stuckDetail,
  stuckStudents,
  type CheckRow,
  type Flag,
  type SkillLevel,
  type StuckDetail,
} from "./insights";
import { scoreChecks, type SkillScores } from "./progress";
import { STAFF_CONTACT } from "./coach/distress";
import { userClient } from "./db";

/**
 * Reads for the instructor console. Every query goes through userClient(), so the access rules
 * (RLS in the pilot, the same rules in the demo store) decide which sections, students, attempts,
 * flags and eval runs the instructor can see. Nothing here filters by role.
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

/** One student the instructor can see, with their section. Null when the access rules hide them. */
export async function studentById(studentId: string): Promise<(StudentRow & { section_id: string }) | null> {
  const db = await userClient();
  const { data, error } = await db.from("students").select("id, display_name, track, section_id").eq("id", studentId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as (StudentRow & { section_id: string }) | null) ?? null;
}

type RawCheck = {
  attempt_id: string;
  check_key: string;
  skill: Skill;
  pass: boolean;
  attempts: { student_id: string; created_at: string; exercise_id: string };
};

/** All check results for these students (practice and skills checks), paged 1,000 rows at a time. */
export async function checkRowsFor(studentIds: string[]): Promise<CheckRow[]> {
  if (!studentIds.length) return [];
  const db = await userClient();
  const page = (from: number) =>
    db
      .from("check_results")
      .select("attempt_id, check_key, skill, pass, attempts!inner(student_id, created_at, exercise_id)", { count: from === 0 ? "exact" : undefined })
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
    exercise_id: r.attempts.exercise_id,
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

export function findCheck(key: string, skill?: string): RubricCheck | undefined {
  for (const ex of EXERCISES) {
    const c = ex.checks.find((k) => k.key === key && (!skill || k.skill === skill));
    if (c) return c;
  }
  return undefined;
}

export interface MiniLesson {
  skill: Skill;
  /** Stuck students on this skill. 0 when nobody is stuck and this is simply the section's most-missed check. */
  students: number;
  check: { key: string; text: string; miniLesson: string; rate: number; n: number };
  /** The same check across the whole section's practice. */
  section: { rate: number; n: number };
}

/**
 * The check to teach next. For the skill with the most stuck students: the check those students fail
 * most. With nobody stuck: the section's most-missed practice check. Rows must be practice rows.
 */
export function suggestMiniLesson(rows: CheckRow[], flags: Flag[]): MiniLesson | null {
  const sectionRate = (key: string) => {
    const mine = rows.filter((r) => r.check_key === key);
    return { rate: mine.length ? mine.filter((r) => r.pass).length / mine.length : 0, n: mine.length };
  };
  const pick = (candidates: ReturnType<typeof hardestChecks>, skill: Skill | null, students: number): MiniLesson | null => {
    for (const h of candidates) {
      const c = findCheck(h.key, h.skill);
      if (c) return { skill: skill ?? c.skill, students, check: { key: c.key, text: c.text, miniLesson: c.miniLesson, rate: h.rate, n: h.n }, section: sectionRate(c.key) };
    }
    return null;
  };
  if (!flags.length) return pick(hardestChecks(rows, 10), null, 0);
  const bySkill = new Map<Skill, Set<string>>();
  for (const f of flags) bySkill.set(f.skill, (bySkill.get(f.skill) ?? new Set()).add(f.student_id));
  const [skill, students] = [...bySkill.entries()].sort((a, b) => b[1].size - a[1].size)[0]!;
  return pick(hardestChecks(rows.filter((r) => r.skill === skill && students.has(r.student_id)), 10), skill, students.size);
}

// ---------------------------------------------------------------- starting point to now

/** The program goal: final check scores 25% higher than the starting point. */
export const LIFT_GOAL = 0.25;

export interface LiftRow {
  skill: Skill;
  start: number | null;
  final: number | null;
  /** Students with both a starting point and a final score on this skill. */
  n: number;
}

export interface Lift {
  bySkill: LiftRow[];
  start: number | null;
  final: number | null;
  /** (final - start) / start. Null until someone has taken both checks. */
  lift: number | null;
  tookStart: number;
  tookFinal: number;
  tookBoth: number;
}

/** Relative lift: (final - start) / start. Null when either side is missing or start is 0. */
export function liftOf(start: number | null, final: number | null): number | null {
  return start === null || final === null || start === 0 ? null : (final - start) / start;
}

/** Section average per skill on the starting point vs the final check, over students who took both. */
export function sectionLift(rows: CheckRow[]): Lift {
  const byStudent = new Map<string, { exercise_id: string; skill: string; pass: boolean }[]>();
  for (const r of rows) {
    if (!isSkillCheck(r.exercise_id)) continue;
    const list = byStudent.get(r.student_id) ?? [];
    list.push({ exercise_id: r.exercise_id!, skill: r.skill, pass: r.pass });
    byStudent.set(r.student_id, list);
  }
  const scores: { start: SkillScores; final: SkillScores }[] = [];
  let tookStart = 0;
  let tookFinal = 0;
  for (const list of byStudent.values()) {
    const start = scoreChecks(list, "start");
    const final = scoreChecks(list, "final");
    const hasStart = SKILLS.some((s) => start[s] !== null);
    const hasFinal = SKILLS.some((s) => final[s] !== null);
    if (hasStart) tookStart++;
    if (hasFinal) tookFinal++;
    if (hasStart && hasFinal) scores.push({ start, final });
  }
  const bySkill = SKILLS.map((skill): LiftRow => {
    const both = scores.filter((x) => x.start[skill] !== null && x.final[skill] !== null);
    return { skill, start: avg(both.map((x) => x.start[skill])), final: avg(both.map((x) => x.final[skill])), n: both.length };
  });
  const start = avg(bySkill.map((r) => r.start));
  const final = avg(bySkill.map((r) => r.final));
  return { bySkill, start, final, lift: liftOf(start, final), tookStart, tookFinal, tookBoth: scores.length };
}

// ---------------------------------------------------------------- section overview

export interface SectionOverview {
  students: StudentRow[];
  /** Practice only: the skills checks are left out. */
  levels: Map<string, Record<Skill, SkillLevel>>;
  /** Stuck students (one flag per student and skill), from practice only. */
  flags: Flag[];
  stuck: StuckDetail[];
  miniLesson: MiniLesson | null;
  lift: Lift;
}

export async function sectionOverview(sectionId: string): Promise<SectionOverview> {
  const students = await sectionStudents(sectionId);
  const all = await checkRowsFor(students.map((s) => s.id));
  const rows = practiceOnly(all);
  const levels = skillLevels(rows);
  const flags = stuckStudents(levels);
  const stuck = flags.map((f) => stuckDetail(rows, f)).filter((d): d is StuckDetail => d !== null);
  return { students, levels, flags, stuck, miniLesson: suggestMiniLesson(rows, flags), lift: sectionLift(all) };
}

// ---------------------------------------------------------------- flags and attempts

export interface SafetyFlagRow {
  id: number;
  student_id: string;
  kind: string;
  detail: string;
  created_at: string;
  status?: "open" | "resolved";
  resolved_at?: string | null;
  resolution_note?: string | null;
}

/** Every flag for one student, open and handled, newest first. */
export async function studentFlags(studentId: string): Promise<SafetyFlagRow[]> {
  const db = await userClient();
  const { data, error } = await db
    .from("safety_flags")
    .select("id, student_id, kind, detail, status, created_at, resolved_at, resolution_note")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SafetyFlagRow[];
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

/** Attempts for several students, newest first. */
export async function attemptsFor(studentIds: string[]): Promise<AttemptListRow[]> {
  if (!studentIds.length) return [];
  const db = await userClient();
  const { data, error } = await db.from("attempts").select(LIST_COLS).in("student_id", studentIds).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AttemptListRow[];
}

export async function studentAttempts(studentId: string): Promise<AttemptListRow[]> {
  return attemptsFor([studentId]);
}

/** Scored attempts not yet sent to the gradebook: what release_scores would send. */
export async function unreleasedCount(studentIds: string[]): Promise<number> {
  if (!studentIds.length) return 0;
  const db = await userClient();
  const { data, error } = await db.from("attempts").select("id").eq("status", "scored").neq("studio", "check").is("released_at", null).in("student_id", studentIds);
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

// ---------------------------------------------------------------- needs you today

export type NeedsYouKind = "support" | "class" | "stuck" | "review" | "safety";

export interface NeedsYouRow {
  kind: NeedsYouKind;
  /** The student the row is about. For a class-wide row, the first of `students`. */
  student_id: string;
  /** Class-wide rows only: everyone stuck on the skill. */
  students?: string[];
  skill?: Skill;
  /** Exercise the row is about, when known. */
  exercise_id: string | null;
  /** Attempt to open from the row. Null when no single attempt explains it. */
  attempt_id: string | null;
  /** Plain-language facts, already worded for the row. */
  headline: string;
  detail: string;
  /** Other open items for the same student. */
  also: string[];
}

const KIND_ORDER: Record<NeedsYouKind, number> = { support: 0, class: 1, stuck: 2, review: 3, safety: 4 };

const FLAG_HEADLINES: Record<string, string> = {
  distress: "Support needed",
  pii_removed: "Personal details removed",
  prompt_injection: "Tried to game the coach",
  refusal: "The AI refused a request",
};

/** Flags are written seconds before or after the attempt that raised them. */
const FLAG_WINDOW_MS = 2 * 60_000;

const plainCheck = (text: string) => text.replace(/\?$/, "");

/**
 * The short list at the top of the console. One row per student, most urgent reason first:
 * a support flag, a class-wide gap, stuck on a skill, a score the coach could not confirm,
 * then other safety flags.
 */
export async function needsYouToday(overview: SectionOverview): Promise<NeedsYouRow[]> {
  const ids = overview.students.map((s) => s.id);
  const [flags, review] = await Promise.all([openSafetyFlags(ids), needsReviewAttempts(ids)]);
  const flaggedAttempts = await attemptsFor([...new Set(flags.map((f) => f.student_id))]);

  const items: NeedsYouRow[] = [];
  for (const f of flags) {
    const t = Date.parse(f.created_at);
    // Only link an attempt we can tie to the flag. Otherwise the row opens the student.
    const at = flaggedAttempts.find(
      (a) => a.student_id === f.student_id && Math.abs(Date.parse(a.created_at) - t) <= FLAG_WINDOW_MS && (f.kind !== "distress" || a.status === "distress"),
    );
    items.push({
      kind: f.kind === "distress" ? "support" : "safety",
      student_id: f.student_id,
      exercise_id: at?.exercise_id ?? null,
      attempt_id: at?.id ?? null,
      headline: FLAG_HEADLINES[f.kind] ?? f.kind,
      detail:
        f.kind === "distress"
          ? `Wrote something in ${flagPlace(f.detail, at?.exercise_id ?? null)} on ${dayText(f.created_at)} that sounded like personal distress. The coach paused and showed the Student Support contact. Check in with them today.`
          : f.detail,
      also: [],
    });
  }

  const bySkill = new Map<Skill, StuckDetail[]>();
  for (const d of overview.stuck) bySkill.set(d.skill, [...(bySkill.get(d.skill) ?? []), d]);
  for (const [skill, list] of bySkill) {
    if (list.length >= CLASS_WIDE_MIN) {
      items.push({
        kind: "class",
        student_id: list[0]!.student_id,
        students: list.map((d) => d.student_id),
        skill,
        exercise_id: null,
        attempt_id: null,
        headline: `${list.length} students stuck on ${SKILL_LABELS[skill]}`,
        detail: "Too many to coach one by one. Teach it to the whole section.",
        also: [],
      });
      continue;
    }
    for (const d of list) {
      const check = findCheck(d.check_key, d.skill);
      items.push({
        kind: "stuck",
        student_id: d.student_id,
        skill,
        exercise_id: d.exercise_id || null,
        attempt_id: d.attempt_id,
        headline: `Stuck on ${SKILL_LABELS[skill]}`,
        detail: `Missed \u201c${plainCheck(check?.text ?? d.check_key)}\u201d on ${d.failed} of ${d.tries} tries.`,
        also: [],
      });
    }
  }

  for (const a of review) {
    items.push({
      kind: "review",
      student_id: a.student_id,
      exercise_id: a.exercise_id,
      attempt_id: a.id,
      headline: "Score needs your review",
      detail: "The coach could not find its quote in the student\u2019s words. Check it before you send scores.",
      also: [],
    });
  }

  items.sort((x, y) => KIND_ORDER[x.kind] - KIND_ORDER[y.kind]);
  // One row per student. Students inside a class-wide row still get their own row for anything else.
  const rows: NeedsYouRow[] = [];
  const byStudent = new Map<string, NeedsYouRow>();
  for (const it of items) {
    if (it.kind === "class") {
      rows.push(it);
      continue;
    }
    const first = byStudent.get(it.student_id);
    if (first) first.also.push(it.headline);
    else {
      byStudent.set(it.student_id, it);
      rows.push(it);
    }
  }
  return rows;
}

// ---------------------------------------------------------------- why one student needs you

/** Where a flag was raised: the linked exercise, else the place named in the flag's summary. */
export function flagPlace(detail: string, exerciseId: string | null): string {
  if (exerciseId) return exerciseTitle(exerciseId);
  return detail.match(/detected in ([^.;]+)/)?.[1]?.trim() ?? "the AI Lab";
}

/** "Tue, Nov 3" in the program's time zone. */
export function dayText(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
}

/** "Tue, Nov 3 at 2:14 PM" in the program's time zone. */
export function whenText(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return `${dayText(iso)} at ${time}`;
}

/** Grader guidance in plain words, without the curriculum section codes. */
export function plainGuidance(guidance: string): string {
  const cut = guidance.split(/\s*\bM\d{2}-S\d/)[0]!.replace(/[\s,(]+$/, "").replace(/^Yes if /, "");
  const s = cut.charAt(0).toUpperCase() + cut.slice(1);
  return s.endsWith(".") ? s : `${s}.`;
}

/** Mini-lesson text without "(M01-S1)"-style section codes. */
export function plainCurriculum(text: string): string {
  return text.replace(/\s*\((?:M\d{2}-S\d+(?:,\s*|\s+and\s+)?)+\)/g, "");
}

export interface CheckTry {
  attempt_id: string;
  exercise_id: string;
  created_at: string;
  pass: boolean;
}

export interface StudentReason {
  kind: Exclude<NeedsYouKind, "class">;
  headline: string;
  /** When it happened (the flag, the attempt, or the latest try). */
  at: string;
  /** What happened, in plain sentences. */
  what: string[];
  /** What the instructor should do about it. */
  todo: string;
  attempt_id: string | null;
  /** Label for the attempt button. */
  action: string | null;
  flag_id?: number;
  stuck?: { skill: Skill; rate: number; check: string; looksLike: string | null; failed: number; tries: number; history: CheckTry[]; others: number };
}

const SAFETY_TODO: Record<string, string> = {
  pii_removed: "Nothing urgent. Personal details were removed before the coach saw the work. Remind them to use made-up details in practice.",
  prompt_injection: "The coach graded the work as written. Worth a quick word about doing the task as asked.",
  refusal: "Open the try. If the AI keeps refusing, the task wording may need a fix.",
};

/**
 * Every reason a student is on the instructor's list, worded for the student page: what happened,
 * when, and what to do. Uses the same rules as "Needs you today", so the two never disagree.
 */
export function studentReasons(
  student: { id: string; display_name: string },
  rows: CheckRow[],
  attempts: AttemptListRow[],
  flags: SafetyFlagRow[],
  sectionStuck: StuckDetail[] = [],
): StudentReason[] {
  const first = student.display_name.split(" ")[0]!;
  const out: StudentReason[] = [];

  for (const f of flags.filter((x) => (x.status ?? "open") === "open")) {
    const t = Date.parse(f.created_at);
    const at = attempts.find((a) => Math.abs(Date.parse(a.created_at) - t) <= FLAG_WINDOW_MS && (f.kind !== "distress" || a.status === "distress"));
    if (f.kind === "distress") {
      out.push({
        kind: "support",
        headline: "Support needed",
        at: f.created_at,
        what: [
          `${first} wrote something in ${flagPlace(f.detail, at?.exercise_id ?? null)} that sounded like personal distress, not a question about the lesson.`,
          `The coach did not answer it. ${first} saw a message pointing them to ${STAFF_CONTACT.name} in Student Support, and to 988 if they are in danger.`,
          "What they wrote is not saved, to protect their privacy. That is why you can't see it here.",
        ],
        todo: `Check in with ${first} privately today. If you think they may be in danger, contact Student Support right away.`,
        attempt_id: null,
        action: null,
        flag_id: f.id,
      });
    } else {
      out.push({
        kind: "safety",
        headline: FLAG_HEADLINES[f.kind] ?? f.kind,
        at: f.created_at,
        what: [f.detail],
        todo: SAFETY_TODO[f.kind] ?? "Open the try and decide if it needs a word with the student.",
        attempt_id: at?.id ?? null,
        action: at ? "Open the try" : null,
        flag_id: f.id,
      });
    }
  }

  const practice = practiceOnly(rows.filter((r) => r.student_id === student.id));
  const levels = skillLevels(practice);
  for (const fl of stuckStudents(levels).filter((x) => x.student_id === student.id)) {
    const d = stuckDetail(practice, fl);
    if (!d) continue;
    const check = findCheck(d.check_key, d.skill);
    const name = (check?.text ?? d.check_key).replace(/\?$/, "");
    const history = practice
      .filter((r) => r.check_key === d.check_key)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-6)
      .map((r) => ({ attempt_id: r.attempt_id, exercise_id: r.exercise_id ?? "", created_at: r.created_at, pass: r.pass }));
    const others = sectionStuck.filter((s) => s.skill === d.skill && s.student_id !== student.id).length;
    out.push({
      kind: "stuck",
      headline: `Stuck on ${SKILL_LABELS[d.skill]}`,
      at: history.at(-1)?.created_at ?? new Date().toISOString(),
      what: [
        `${first} passed ${Math.round(d.current * 100)}% of ${SKILL_LABELS[d.skill]} checks on their last 3 practice tries. Under 40% puts a student on your list.`,
        `The one they miss most: \u201c${name}\u201d, missed on ${d.failed} of ${d.tries} tries.`,
      ],
      todo:
        others >= CLASS_WIDE_MIN - 1
          ? `${others} others in the section are stuck on this too, so the mini-lesson on your console covers it. Then open ${first}'s latest try with them and have them try once more.`
          : `Open ${first}'s latest try with them, point to where it falls short, and have them try once more.`,
      attempt_id: d.attempt_id,
      action: "Open their latest try",
      stuck: { skill: d.skill, rate: d.current, check: name, looksLike: check ? plainGuidance(check.guidance) : null, failed: d.failed, tries: d.tries, history, others },
    });
  }

  for (const a of attempts.filter((x) => x.status === "needs_review")) {
    out.push({
      kind: "review",
      headline: "Score needs your review",
      at: a.created_at,
      what: [`The coach scored ${exerciseTitle(a.exercise_id)} but could not find its quote in ${first}'s words, so that score is on hold.`],
      todo: "Read the try and save your call on the flagged check. Held scores never reach the gradebook.",
      attempt_id: a.id,
      action: "Review the score",
    });
  }

  return out.sort((x, y) => KIND_ORDER[x.kind] - KIND_ORDER[y.kind]);
}

// ---------------------------------------------------------------- coach reliability

export interface CoachReliability {
  grading: { agreement: number; gate: number; passed: boolean; heldOutChecks: number; model: string; promptVersion: string; at: string } | null;
  safety: { passed: number; total: number; ok: boolean; at: string } | null;
}

type EvalRun = { kind: string; model: string; prompt_version: string; summary: Record<string, unknown>; passed_gate: boolean; created_at: string };

const GRADING_GATE = 0.8;

/** The latest measured eval runs (aggregate numbers only, no student data). */
export async function coachReliability(): Promise<CoachReliability> {
  const db = await userClient();
  const { data, error } = await db
    .from("eval_runs")
    .select("kind, model, prompt_version, summary, passed_gate, created_at")
    .in("kind", ["grading", "safety"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { grading: null, safety: null };
  const runs = (data ?? []) as EvalRun[];
  const g = runs.find((r) => r.kind === "grading" && typeof r.summary?.heldOutAgreement === "number");
  const s = runs.find((r) => r.kind === "safety" && typeof r.summary?.safetyTotal === "number");
  const counts = (g?.summary?.agreement as { counts?: { test?: { n?: number } } } | undefined)?.counts?.test?.n;
  return {
    grading: g
      ? {
          agreement: g.summary.heldOutAgreement as number,
          gate: GRADING_GATE,
          passed: g.passed_gate,
          heldOutChecks: typeof counts === "number" ? counts : 0,
          model: g.model,
          promptVersion: g.prompt_version,
          at: g.created_at,
        }
      : null,
    safety: s ? { passed: Number(s.summary.safetyPassed ?? 0), total: Number(s.summary.safetyTotal), ok: s.passed_gate, at: s.created_at } : null,
  };
}

// ---------------------------------------------------------------- replay

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

/** "Meeting recap for your manager", or "Starting point: Write a prompt" for a skills-check task. */
export function exerciseTitle(id: string): string {
  const ex = getExercise(id);
  if (!ex) return id;
  if (ex.checkKind === "start") return `Starting point: ${ex.title}`;
  if (ex.checkKind === "final") return `Final check: ${ex.title}`;
  return ex.title;
}
