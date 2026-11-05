import "server-only";
import { AGENT_CHECKS, ARENA_CHECKS, PROMPT_CHECKS } from "./curriculum/checks";
import { EXERCISES } from "./curriculum/exercises";
import { SKILLS, type RubricCheck, type Skill } from "./curriculum/types";
import { budgetConfig } from "./coach/budget";
import { userClient } from "./db";

/**
 * Reads for the two staff screens (admin and security center, curriculum insights).
 * Every read goes through the viewer's own session, so RLS decides what comes back.
 * The curriculum view only ever sees aggregates from curriculum_check_stats(): no student rows.
 */

/** Students in the sample data, and the size of a real Year Up cycle we scale estimates to. */
export const SAMPLE_STUDENTS = 120;
export const CYCLE_STUDENTS = 1700;
/** Eval gate from the PRD. */
export const GATE_HELD_OUT = 0.8;
export const GATE_SAFETY_TOTAL = 20;

// ---------------------------------------------------------------- small helpers

export function usd(x: number): string {
  if (!Number.isFinite(x)) return "–";
  return `$${x < 1 ? x.toFixed(4) : x.toFixed(2)}`;
}

export function num(x: number): string {
  return Math.round(x).toLocaleString("en-US");
}

/** Accepts 0.85 or 85 and returns 0.85. */
export function asRate(x: unknown): number | null {
  const n = typeof x === "string" ? Number(x) : x;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

/** heat-0 (worst) to heat-4 (best), heat-na when there is no data. */
export function heatClass(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "heat heat-na";
  if (rate < 0.4) return "heat heat-0";
  if (rate < 0.55) return "heat heat-1";
  if (rate < 0.7) return "heat heat-2";
  if (rate < 0.85) return "heat heat-3";
  return "heat heat-4";
}

export function firstOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const ALL_CHECKS: RubricCheck[] = [...PROMPT_CHECKS, ...ARENA_CHECKS, ...AGENT_CHECKS];
export function staticCheck(key: string): RubricCheck | undefined {
  return ALL_CHECKS.find((c) => c.key === key);
}

type Db = Awaited<ReturnType<typeof userClient>>;

/** PostgREST caps a response at 1,000 rows, so page through larger reads. */
async function fetchAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; from < 200_000; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

// ---------------------------------------------------------------- eval runs

export interface EvalRun {
  id: string;
  kind: string;
  model: string;
  prompt_version: string;
  summary: Record<string, unknown>;
  passed_gate: boolean;
  rubric_draft_id: number | null;
  created_at: string;
}

/**
 * PASS/FAIL against the PRD gate: at least 80% held-out agreement for grading, 20/20 for safety.
 * Uses the summary numbers when present, else falls back to the stored passed_gate.
 */
export function gateVerdict(run: EvalRun): { pass: boolean; basis: string } {
  const s = run.summary ?? {};
  if (run.kind === "safety") {
    const p = Number(s.safetyPassed);
    const t = Number(s.safetyTotal);
    if (Number.isFinite(p) && Number.isFinite(t) && t > 0) {
      return { pass: p === t && t >= GATE_SAFETY_TOTAL, basis: `${p}/${t} safety cases (gate: ${GATE_SAFETY_TOTAL}/${GATE_SAFETY_TOTAL})` };
    }
  } else {
    const h = asRate(s.heldOutAgreement);
    if (h !== null) return { pass: h >= GATE_HELD_OUT, basis: `${Math.round(h * 100)}% held-out agreement (gate: 80%)` };
  }
  return { pass: run.passed_gate, basis: "stored gate result" };
}

// ---------------------------------------------------------------- admin

export interface CohortUsage {
  section_id: string;
  purpose: string;
  calls: number;
  tokens: number;
  cost_usd: number;
}

export interface AdminOverview {
  profiles: { id: string; display_name: string; role: string; persona: string }[];
  budget: { monthlyCapUsd: number; dailyTokensPerStudent: number };
  month: { since: string; spend: number; calls: number; tokens: number; byModel: { model: string; calls: number; tokens: number; cost: number }[] };
  cohorts: CohortUsage[];
  allTime: { studentSpend: number; staffSpend: number; perStudent: number; projectedCycle: number };
  audit: { id: number; actor: string; actor_role: string | null; action: string; target: string | null; reason: string | null; created_at: string }[];
  flags: { id: number; student_id: string | null; kind: string; detail: string; status: string; created_at: string }[];
  evals: { grading: EvalRun | null; safety: EvalRun | null };
  errors: string[];
}

async function cohortUsage(db: Db, since: Date, errors: string[]): Promise<CohortUsage[]> {
  const { data, error } = await db.rpc("usage_by_cohort", { p_since: since.toISOString() });
  if (error) {
    errors.push(`Usage by cohort: ${error.message}`);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => ({
      section_id: String(r.section_id),
      purpose: String(r.purpose),
      calls: Number(r.calls ?? 0),
      tokens: Number(r.tokens ?? 0),
      cost_usd: Number(r.cost_usd ?? 0),
    }))
    .sort((a, b) => a.section_id.localeCompare(b.section_id) || a.purpose.localeCompare(b.purpose));
}

async function latestEval(db: Db, kind: "grading" | "safety", errors: string[]): Promise<EvalRun | null> {
  const { data, error } = await db
    .from("eval_runs")
    .select("id, kind, model, prompt_version, summary, passed_gate, rubric_draft_id, created_at")
    .eq("kind", kind)
    .is("rubric_draft_id", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    errors.push(`Eval runs: ${error.message}`);
    return null;
  }
  return (data?.[0] as EvalRun | undefined) ?? null;
}

export async function adminOverview(): Promise<AdminOverview> {
  const db = await userClient();
  const errors: string[] = [];
  const since = firstOfMonth();

  const [profilesRes, ledger, cohorts, allCohorts, auditRes, flagsRes, grading, safety] = await Promise.all([
    db.from("profiles").select("id, display_name, role, persona").order("role").order("display_name"),
    fetchAllPages<{ model: string; cost_usd: number | string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number }>((from, to) =>
      db
        .from("usage_ledger")
        .select("model, cost_usd, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens")
        .gte("created_at", since.toISOString())
        .order("id")
        .range(from, to),
    ).catch((e: Error) => {
      errors.push(`Usage ledger: ${e.message}`);
      return [];
    }),
    cohortUsage(db, since, errors),
    cohortUsage(db, new Date("2000-01-01T00:00:00Z"), errors),
    db.from("audit_log").select("id, actor, actor_role, action, target, reason, created_at").order("created_at", { ascending: false }).limit(50),
    db.from("safety_flags").select("id, student_id, kind, detail, status, created_at").order("created_at", { ascending: false }),
    latestEval(db, "grading", errors),
    latestEval(db, "safety", errors),
  ]);

  if (profilesRes.error) errors.push(`Profiles: ${profilesRes.error.message}`);
  if (auditRes.error) errors.push(`Audit log: ${auditRes.error.message}`);
  if (flagsRes.error) errors.push(`Safety flags: ${flagsRes.error.message}`);
  const profiles = profilesRes.data ?? [];
  const nameOf = new Map(profiles.map((p) => [p.id, p.display_name]));

  const byModel = new Map<string, { model: string; calls: number; tokens: number; cost: number }>();
  let spend = 0;
  let tokens = 0;
  for (const r of ledger) {
    const t = r.input_tokens + r.output_tokens + r.cache_read_tokens + r.cache_write_tokens;
    const c = Number(r.cost_usd);
    spend += c;
    tokens += t;
    const m = byModel.get(r.model) ?? { model: r.model, calls: 0, tokens: 0, cost: 0 };
    m.calls++;
    m.tokens += t;
    m.cost += c;
    byModel.set(r.model, m);
  }

  const studentSpend = allCohorts.filter((c) => c.section_id !== "staff/eval").reduce((s, c) => s + c.cost_usd, 0);
  const staffSpend = allCohorts.filter((c) => c.section_id === "staff/eval").reduce((s, c) => s + c.cost_usd, 0);
  const perStudent = studentSpend / SAMPLE_STUDENTS;

  return {
    profiles,
    budget: budgetConfig(),
    month: { since: since.toISOString(), spend, calls: ledger.length, tokens, byModel: [...byModel.values()].sort((a, b) => b.cost - a.cost) },
    cohorts,
    allTime: { studentSpend, staffSpend, perStudent, projectedCycle: perStudent * CYCLE_STUDENTS },
    audit: (auditRes.data ?? []).map((a) => ({ ...a, actor: a.actor ? (nameOf.get(a.actor) ?? "Unknown account") : "System" })),
    flags: flagsRes.data ?? [],
    evals: { grading, safety },
    errors,
  };
}

// ---------------------------------------------------------------- curriculum

export interface StatCell {
  attempts: number;
  rate: number;
}

export interface CheckStatRow {
  exerciseId: string;
  exerciseTitle: string;
  key: string;
  text: string;
  skill: string;
  bySection: Record<string, StatCell | undefined>;
  overall: number | null;
  n: number;
}

export interface HardCheck {
  key: string;
  text: string;
  skill: string;
  rate: number;
  n: number;
  miniLesson: string;
}

export interface RubricRow {
  id: number;
  exercise_id: string;
  key: string;
  version: number;
  text: string;
  skill: string;
  method: string;
  status: string;
  created_at: string;
}

export interface DraftView extends RubricRow {
  exerciseTitle: string;
  publishedText: string | null;
  latestEval: { id: string; passed_gate: boolean; summary: Record<string, unknown>; created_at: string } | null;
  canPublish: boolean;
}

export interface CurriculumOverview {
  sections: string[];
  rows: CheckStatRow[];
  hardest: HardCheck[];
  trend: { week: number; skill: Skill; pass_rate: number; students: number }[];
  editor: { id: string; title: string; checks: { key: string; text: string; skill: string; version: number }[] }[];
  drafts: DraftView[];
  errors: string[];
}

export async function curriculumOverview(): Promise<CurriculumOverview> {
  const db = await userClient();
  const errors: string[] = [];

  const [statsRes, rollupsRes, rubricRes] = await Promise.all([
    db.rpc("curriculum_check_stats"),
    db.from("program_rollups").select("week, skill, pass_rate, students").order("week"),
    db.from("rubric_checks").select("id, exercise_id, key, version, text, skill, method, status, created_at").order("version"),
  ]);
  if (statsRes.error) errors.push(`Check stats: ${statsRes.error.message}`);
  if (rollupsRes.error) errors.push(`Program trend: ${rollupsRes.error.message}`);
  if (rubricRes.error) errors.push(`Rubric: ${rubricRes.error.message}`);

  const rubric = (rubricRes.data ?? []) as RubricRow[];
  const published = new Map<string, RubricRow>();
  for (const r of rubric) if (r.status === "published") published.set(`${r.exercise_id}:${r.key}`, r);
  const textFor = (exerciseId: string, key: string, fallback: string) => published.get(`${exerciseId}:${key}`)?.text ?? fallback;

  // exercise:key -> section -> cell
  const stats = new Map<string, Map<string, StatCell>>();
  const sections = new Set<string>();
  for (const r of (statsRes.data ?? []) as Record<string, unknown>[]) {
    const k = `${r.exercise_id}:${r.check_key}`;
    const m = stats.get(k) ?? new Map<string, StatCell>();
    stats.set(k, m);
    const section = String(r.section_id);
    sections.add(section);
    m.set(section, { attempts: Number(r.attempts ?? 0), rate: Number(r.pass_rate ?? 0) });
  }
  const sectionList = [...new Set(["A", "B", "C", ...sections])].sort();

  const rows: CheckStatRow[] = [];
  const byKey = new Map<string, { key: string; skill: string; n: number; passes: number }>();
  for (const ex of EXERCISES) {
    for (const c of ex.checks) {
      const cells = stats.get(`${ex.id}:${c.key}`) ?? new Map<string, StatCell>();
      let n = 0;
      let passes = 0;
      for (const cell of cells.values()) {
        n += cell.attempts;
        passes += cell.attempts * cell.rate;
      }
      rows.push({
        exerciseId: ex.id,
        exerciseTitle: ex.title,
        key: c.key,
        text: textFor(ex.id, c.key, c.text),
        skill: c.skill,
        bySection: Object.fromEntries(sectionList.map((s) => [s, cells.get(s)])),
        overall: n ? passes / n : null,
        n,
      });
      const agg = byKey.get(c.key) ?? { key: c.key, skill: c.skill, n: 0, passes: 0 };
      agg.n += n;
      agg.passes += passes;
      byKey.set(c.key, agg);
    }
  }

  // Same idea as insights.hardestChecks, but over the pre-aggregated counts the RPC returns.
  const hardest: HardCheck[] = [...byKey.values()]
    .filter((a) => a.n >= 20)
    .map((a) => {
      const sc = staticCheck(a.key);
      return { key: a.key, text: sc?.text ?? a.key, skill: a.skill, rate: a.passes / a.n, n: a.n, miniLesson: sc?.miniLesson ?? "" };
    })
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5);

  const trend = ((rollupsRes.data ?? []) as Record<string, unknown>[])
    .filter((r) => (SKILLS as readonly string[]).includes(String(r.skill)))
    // The seeder writes 0 for a week where no exercise tests that skill (e.g. Description is only
    // tested in week 1). A true 0% across a 1,700-student cycle is not plausible, so treat it as no data.
    .filter((r) => Number(r.pass_rate) > 0)
    .map((r) => ({ week: Number(r.week), skill: r.skill as Skill, pass_rate: Number(r.pass_rate), students: Number(r.students) }));

  const editor = EXERCISES.map((ex) => ({
    id: ex.id,
    title: ex.title,
    checks: ex.checks.map((c) => {
      const p = published.get(`${ex.id}:${c.key}`);
      return { key: c.key, text: p?.text ?? c.text, skill: c.skill, version: p?.version ?? 1 };
    }),
  }));

  // Drafts plus anything that started life as a draft (version 2+), newest first.
  const draftRows = rubric.filter((r) => r.status === "draft" || r.version > 1).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const evalByDraft = new Map<number, DraftView["latestEval"]>();
  const passedDrafts = new Set<number>();
  if (draftRows.length) {
    const { data, error } = await db
      .from("eval_runs")
      .select("id, passed_gate, summary, created_at, rubric_draft_id")
      .in(
        "rubric_draft_id",
        draftRows.map((d) => d.id),
      )
      .order("created_at", { ascending: false });
    if (error) errors.push(`Draft evals: ${error.message}`);
    for (const r of data ?? []) {
      const id = Number(r.rubric_draft_id);
      const prev = evalByDraft.get(id);
      // Keep the newest run for display; any passing run unlocks Publish (same rule as the DB).
      if (!prev) evalByDraft.set(id, { id: r.id, passed_gate: r.passed_gate, summary: (r.summary ?? {}) as Record<string, unknown>, created_at: r.created_at });
    }
    for (const r of data ?? []) {
      if (r.passed_gate) passedDrafts.add(Number(r.rubric_draft_id));
    }
  }

  const drafts: DraftView[] = draftRows.map((d) => ({
    ...d,
    exerciseTitle: EXERCISES.find((e) => e.id === d.exercise_id)?.title ?? d.exercise_id,
    publishedText: d.status === "draft" ? (published.get(`${d.exercise_id}:${d.key}`)?.text ?? null) : null,
    latestEval: evalByDraft.get(d.id) ?? null,
    canPublish: d.status === "draft" && passedDrafts.has(d.id),
  }));

  return { sections: sectionList, rows, hardest, trend, editor, drafts, errors };
}
