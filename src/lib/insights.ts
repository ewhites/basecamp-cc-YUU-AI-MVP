import { SKILL_CHECKS } from "./curriculum/skill-checks";
import { SKILLS, type Skill } from "./curriculum/types";

/**
 * Class insights shared by the instructor console and the MCP server.
 * Pure functions over rows the caller already fetched through RLS, so they can never widen access.
 */

export interface CheckRow {
  attempt_id: string;
  student_id: string;
  created_at: string;
  skill: Skill;
  check_key: string;
  pass: boolean;
  /** Present when the caller selected it. Needed to tell practice apart from the skills checks. */
  exercise_id?: string;
}

const SKILL_CHECK_IDS = new Set(SKILL_CHECKS.map((e) => e.id));

/** The starting point and final check tasks (sp-*, fc-*). They measure lift, not practice. */
export function isSkillCheck(exerciseId: string | undefined): boolean {
  return !!exerciseId && SKILL_CHECK_IDS.has(exerciseId);
}

/** Practice rows only. Skills-check rows would skew the heatmap and the stuck rule. */
export function practiceOnly<T extends { exercise_id?: string }>(rows: T[]): T[] {
  return rows.filter((r) => !isSkillCheck(r.exercise_id));
}

export interface SkillLevel {
  /** Pass rate on this skill's checks across the student's last RECENT_ATTEMPTS attempts that test it. */
  current: number | null;
  /** Pass rate on the student's first attempt that tested this skill. */
  first: number | null;
  checks: number;
}

export const RECENT_ATTEMPTS = 3;
/** Flag rule: below this pass rate on a skill across the last 3 attempts that test it. */
export const STUCK_THRESHOLD = 0.4;
/** Never flag on less evidence than this many checks. */
export const MIN_CHECKS = 4;

export function skillLevels(rows: CheckRow[]): Map<string, Record<Skill, SkillLevel>> {
  // student -> skill -> attempt -> {pass, total, at}
  const tree = new Map<string, Map<Skill, Map<string, { pass: number; total: number; at: string }>>>();
  for (const r of rows) {
    const bySkill = tree.get(r.student_id) ?? new Map();
    tree.set(r.student_id, bySkill);
    const byAttempt = bySkill.get(r.skill) ?? new Map();
    bySkill.set(r.skill, byAttempt);
    const a = byAttempt.get(r.attempt_id) ?? { pass: 0, total: 0, at: r.created_at };
    a.total++;
    if (r.pass) a.pass++;
    byAttempt.set(r.attempt_id, a);
  }
  const out = new Map<string, Record<Skill, SkillLevel>>();
  for (const [student, bySkill] of tree) {
    const levels = {} as Record<Skill, SkillLevel>;
    for (const skill of SKILLS) {
      const attempts = [...(bySkill.get(skill)?.values() ?? [])].sort((x, y) => x.at.localeCompare(y.at));
      // Last 3 attempts that test the skill, widened until there are at least MIN_CHECKS checks of evidence.
      let k = Math.min(RECENT_ATTEMPTS, attempts.length);
      while (k < attempts.length && attempts.slice(-k).reduce((n, a) => n + a.total, 0) < MIN_CHECKS) k++;
      const recent = attempts.slice(-k);
      const sum = (xs: typeof attempts) => xs.reduce((acc, a) => ({ p: acc.p + a.pass, t: acc.t + a.total }), { p: 0, t: 0 });
      const r = sum(recent);
      const f = attempts[0];
      levels[skill] = {
        current: r.t ? r.p / r.t : null,
        first: f ? f.pass / f.total : null,
        checks: sum(attempts).t,
      };
    }
    out.set(student, levels);
  }
  return out;
}

export interface Flag {
  student_id: string;
  skill: Skill;
  current: number;
}

export function stuckStudents(levels: Map<string, Record<Skill, SkillLevel>>, skill?: Skill): Flag[] {
  const flags: Flag[] = [];
  for (const [student_id, lv] of levels) {
    for (const s of skill ? [skill] : SKILLS) {
      const c = lv[s].current;
      if (c !== null && lv[s].checks >= MIN_CHECKS && c < STUCK_THRESHOLD) flags.push({ student_id, skill: s, current: c });
    }
  }
  return flags.sort((a, b) => a.current - b.current);
}

export interface StuckDetail extends Flag {
  /** The practice exercise of their latest attempt on this skill. */
  exercise_id: string;
  /** That latest attempt, for the replay link. */
  attempt_id: string;
  /** The check on this skill they fail most often. */
  check_key: string;
  failed: number;
  tries: number;
}

/** What a stuck student is stuck on: the check on the skill they miss most, and their latest attempt that has it. */
export function stuckDetail(rows: CheckRow[], flag: Flag): StuckDetail | null {
  const mine = rows.filter((r) => r.student_id === flag.student_id && r.skill === flag.skill);
  if (!mine.length) return null;
  const byCheck = new Map<string, { failed: number; tries: number; latest: CheckRow }>();
  for (const r of mine) {
    const c = byCheck.get(r.check_key) ?? { failed: 0, tries: 0, latest: r };
    c.tries++;
    if (!r.pass) c.failed++;
    if (r.created_at > c.latest.created_at) c.latest = r;
    byCheck.set(r.check_key, c);
  }
  const [check_key, worst] = [...byCheck.entries()].sort(
    (a, b) =>
      b[1].failed / b[1].tries - a[1].failed / a[1].tries ||
      b[1].failed - a[1].failed ||
      b[1].latest.created_at.localeCompare(a[1].latest.created_at),
  )[0]!;
  return {
    ...flag,
    exercise_id: worst.latest.exercise_id ?? "",
    attempt_id: worst.latest.attempt_id,
    check_key,
    failed: worst.failed,
    tries: worst.tries,
  };
}

/**
 * When this many students are stuck on the same skill, it is a class-wide gap: teach it to the
 * whole section instead of listing every student.
 */
export const CLASS_WIDE_MIN = 5;

/** Most-failed checks across the rows, for the mini-lesson suggestion and curriculum insights. */
export function hardestChecks(rows: { check_key: string; skill: string; pass: boolean }[], limit = 5) {
  const agg = new Map<string, { key: string; skill: string; n: number; pass: number }>();
  for (const r of rows) {
    const a = agg.get(r.check_key) ?? { key: r.check_key, skill: r.skill, n: 0, pass: 0 };
    a.n++;
    if (r.pass) a.pass++;
    agg.set(r.check_key, a);
  }
  return [...agg.values()]
    .filter((a) => a.n >= 5)
    .map((a) => ({ ...a, rate: a.pass / a.n }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, limit);
}

export function pct(x: number | null | undefined): string {
  return x === null || x === undefined ? "Not yet" : `${Math.round(x * 100)}%`;
}
