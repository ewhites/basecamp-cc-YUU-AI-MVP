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
  return x === null || x === undefined ? "–" : `${Math.round(x * 100)}%`;
}
