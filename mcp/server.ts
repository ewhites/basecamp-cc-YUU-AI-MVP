/**
 * AI Lab MCP server (stdio, READ-ONLY). Lets an assistant ask class questions such as
 * "who in Section B is stuck on Description?" in plain words.
 *
 *   npx tsx mcp/server.ts            (registered as "ai-lab" in .mcp.json)
 *   LAB_MCP_PERSONA=jasmine|rivera|okafor|lee|haddad   (default rivera)
 *
 * It queries the demo data AS the persona, so the same access rules as the app (ported from the
 * Postgres row-level security policies) decide what it can see. It never uses the service client.
 * Output uses pseudonymous student IDs only, never names: whatever this returns goes to an AI.
 * There are no write tools.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AGENT_CHECKS, ARENA_CHECKS, PROMPT_CHECKS } from "../src/lib/curriculum/checks";
import { EXERCISES } from "../src/lib/curriculum/exercises";
import { SKILL_LABELS, SKILLS, type Skill } from "../src/lib/curriculum/types";
import { MIN_CHECKS, skillLevels, STUCK_THRESHOLD, stuckStudents, type CheckRow } from "../src/lib/insights";
import { DemoClient } from "../src/lib/demo/client";
import { PERSONA_IDS } from "../src/lib/demo/sample";

const PERSONA_KEY = (process.env.LAB_MCP_PERSONA ?? "rivera").trim().toLowerCase();
const ALL_CHECKS = [...PROMPT_CHECKS, ...ARENA_CHECKS, ...AGENT_CHECKS];

// ---------------------------------------------------------------- session (RLS as the persona)

type SupabaseClient = DemoClient;
let current: { db: DemoClient; role: string } | null = null;

/** A client acting as the persona: every read goes through the demo's access rules. */
async function asPersona() {
  if (current) return current;
  const uid = PERSONA_IDS[PERSONA_KEY];
  if (!uid) throw new Error(`Unknown LAB_MCP_PERSONA "${PERSONA_KEY}". Use jasmine, rivera, okafor, lee or haddad.`);
  const db = new DemoClient({ kind: "user", uid });
  const { data: prof, error } = await db.from("profiles").select("role").eq("id", uid).maybeSingle();
  if (error) throw new Error(`Could not read the persona's profile: ${error.message}`);
  current = { db, role: (prof?.role as string | undefined) ?? "unknown" };
  return current;
}

// ---------------------------------------------------------------- queries (all through RLS)

function normSection(s: string): string {
  return s.trim().replace(/^section\s+/i, "").toUpperCase();
}

async function studentsIn(db: SupabaseClient, section: string) {
  const { data, error } = await db.from("students").select("id, section_id, track").eq("section_id", section).order("id");
  if (error) throw new Error(error.message);
  return data as { id: string; section_id: string; track: string }[];
}

interface Row extends CheckRow {
  exercise_id: string;
}

/** Every check result the persona can see for these students (paged; PostgREST caps a page at 1,000). */
async function checkRows(db: SupabaseClient, filter: { studentIds?: string[]; exerciseId?: string }): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db
      .from("check_results")
      .select("attempt_id, check_key, skill, pass, attempts!inner(student_id, created_at, exercise_id)")
      .order("attempt_id")
      .order("check_key")
      .range(from, from + 999);
    if (filter.studentIds) q = q.in("attempts.student_id", filter.studentIds);
    if (filter.exerciseId) q = q.eq("attempts.exercise_id", filter.exerciseId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    type Raw = { attempt_id: string; check_key: string; skill: Skill; pass: boolean; attempts: { student_id: string; created_at: string; exercise_id: string } };
    for (const r of data as unknown as Raw[])
      rows.push({
        attempt_id: r.attempt_id,
        check_key: r.check_key,
        skill: r.skill,
        pass: r.pass,
        student_id: r.attempts.student_id,
        created_at: r.attempts.created_at,
        exercise_id: r.attempts.exercise_id,
      });
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

const pct = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x * 100));

function noAccess(what: string, role: string) {
  return {
    visible: false,
    message: `No ${what} visible to ${PERSONA_KEY} (${role}). Row-level security only shows a student their own work and an instructor their own sections; curriculum and admin roles never see individual students.`,
  };
}

async function classOverview(sectionIn: string) {
  const { db, role } = await asPersona();
  const section = normSection(sectionIn);
  const students = await studentsIn(db, section);
  if (!students.length) return { section, persona: PERSONA_KEY, role, ...noAccess(`students in Section ${section}`, role) };
  const ids = students.map((s) => s.id);
  const rows = await checkRows(db, { studentIds: ids });
  const levels = skillLevels(rows);
  const skills = Object.fromEntries(
    SKILLS.map((sk) => {
      const cur = [...levels.values()].map((l) => l[sk].current).filter((x): x is number => x !== null);
      const first = [...levels.values()].map((l) => l[sk].first).filter((x): x is number => x !== null);
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
      return [sk, { label: SKILL_LABELS[sk], firstAttemptPct: pct(avg(first)), currentPct: pct(avg(cur)), students: cur.length }];
    }),
  );
  const flags = stuckStudents(levels);
  const { count: safetyOpen } = await db.from("safety_flags").select("id", { count: "exact", head: true }).in("student_id", ids).eq("status", "open");
  return {
    section,
    persona: PERSONA_KEY,
    role,
    visible: true,
    students: students.length,
    attemptsGraded: new Set(rows.map((r) => r.attempt_id)).size,
    skills,
    flags: { count: flags.length, rule: `current pass rate under ${STUCK_THRESHOLD * 100}% on a skill across the last 3 attempts that test it (at least ${MIN_CHECKS} checks)` },
    openSafetyFlags: safetyOpen ?? 0,
  };
}

async function needingHelp(sectionIn: string, skill: Skill) {
  const { db, role } = await asPersona();
  const section = normSection(sectionIn);
  const students = await studentsIn(db, section);
  if (!students.length) return { section, skill, persona: PERSONA_KEY, role, ...noAccess(`students in Section ${section}`, role) };
  const rows = await checkRows(db, { studentIds: students.map((s) => s.id) });
  const flags = stuckStudents(skillLevels(rows), skill);
  const out = flags.map((f) => {
    const mine = rows.filter((r) => r.student_id === f.student_id && r.skill === skill);
    const fails = new Map<string, { failed: number; total: number }>();
    for (const r of mine) {
      const a = fails.get(r.check_key) ?? { failed: 0, total: 0 };
      a.total++;
      if (!r.pass) a.failed++;
      fails.set(r.check_key, a);
    }
    const [key, stat] = [...fails.entries()].sort((a, b) => b[1].failed - a[1].failed || a[0].localeCompare(b[0]))[0] ?? ["", { failed: 0, total: 0 }];
    const check = ALL_CHECKS.find((c) => c.key === key);
    return {
      student: f.student_id,
      currentPct: pct(f.current),
      mostFailedCheck: check ? { key, text: check.text, failed: stat.failed, of: stat.total } : null,
      miniLesson: check?.miniLesson ?? null,
    };
  });
  return {
    section,
    skill: SKILL_LABELS[skill],
    persona: PERSONA_KEY,
    role,
    visible: true,
    count: out.length,
    rule: `current pass rate under ${STUCK_THRESHOLD * 100}% on ${SKILL_LABELS[skill]} across the last 3 attempts that test it`,
    students: out,
  };
}

async function studentProgress(who: string) {
  const { db, role } = await asPersona();
  const q = who.trim();
  let match: { id: string; section_id: string; track: string }[] = [];
  if (/^S-[A-Z]-\d{3}$/i.test(q)) {
    const { data, error } = await db.from("students").select("id, section_id, track").eq("id", q.toUpperCase());
    if (error) throw new Error(error.message);
    match = data ?? [];
  } else {
    const { data, error } = await db.from("students").select("id, section_id, track").ilike("display_name", `%${q.replace(/[%_]/g, "")}%`).limit(5);
    if (error) throw new Error(error.message);
    match = data ?? [];
  }
  if (!match.length) return { query: q, persona: PERSONA_KEY, role, ...noAccess(`student matching "${q}"`, role) };
  if (match.length > 1) return { query: q, visible: true, ambiguous: true, matches: match.map((m) => m.id), message: "More than one student matches; ask again with a student ID." };
  const st = match[0]!;
  const rows = await checkRows(db, { studentIds: [st.id] });
  const lv = skillLevels(rows).get(st.id);
  const { data: attempts, error } = await db
    .from("attempts")
    .select("exercise_id, attempt_no, status, passed, total, created_at")
    .eq("student_id", st.id)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw new Error(error.message);
  return {
    student: st.id,
    section: st.section_id,
    track: st.track,
    persona: PERSONA_KEY,
    role,
    visible: true,
    skills: Object.fromEntries(
      SKILLS.map((sk) => [sk, { label: SKILL_LABELS[sk], firstAttemptPct: pct(lv?.[sk].first), currentPct: pct(lv?.[sk].current), checks: lv?.[sk].checks ?? 0 }]),
    ),
    recentAttempts: (attempts ?? []).map((a) => ({
      exercise: EXERCISES.find((e) => e.id === a.exercise_id)?.title ?? a.exercise_id,
      attempt: a.attempt_no,
      status: a.status,
      score: a.passed === null ? null : `${a.passed}/${a.total}`,
      at: a.created_at,
    })),
  };
}

async function exerciseStats(which: string) {
  const { db, role } = await asPersona();
  const q = which.trim().toLowerCase();
  const ex = EXERCISES.find((e) => e.id === q) ?? EXERCISES.find((e) => e.title.toLowerCase().includes(q));
  if (!ex) return { error: `No exercise matches "${which}". Exercises: ${EXERCISES.map((e) => `${e.id} (${e.title})`).join(", ")}` };

  const perCheck = new Map<string, { n: number; pass: number }>();
  let source: string;
  if (role === "curriculum" || role === "admin") {
    // These roles never see student rows; the aggregate function returns rates with no names or IDs.
    const { data, error } = await db.rpc("curriculum_check_stats");
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as { exercise_id: string; check_key: string; attempts: number; pass_rate: number }[]) {
      if (r.exercise_id !== ex.id) continue;
      const a = perCheck.get(r.check_key) ?? { n: 0, pass: 0 };
      a.n += Number(r.attempts);
      a.pass += Number(r.attempts) * Number(r.pass_rate);
      perCheck.set(r.check_key, a);
    }
    source = "curriculum_check_stats() aggregate, all sections";
  } else {
    const rows = await checkRows(db, { exerciseId: ex.id });
    for (const r of rows) {
      const a = perCheck.get(r.check_key) ?? { n: 0, pass: 0 };
      a.n++;
      if (r.pass) a.pass++;
      perCheck.set(r.check_key, a);
    }
    source = "check results visible to this persona";
  }
  if (!perCheck.size) return { exercise: ex.id, title: ex.title, persona: PERSONA_KEY, role, ...noAccess(`results for ${ex.title}`, role) };
  return {
    exercise: ex.id,
    title: ex.title,
    studio: ex.studio,
    persona: PERSONA_KEY,
    role,
    visible: true,
    source,
    checks: ex.checks.map((c) => {
      const a = perCheck.get(c.key);
      return { key: c.key, text: c.text, skill: c.skill, results: a?.n ?? 0, passPct: a?.n ? Math.round((a.pass / a.n) * 100) : null };
    }),
  };
}

// ---------------------------------------------------------------- MCP wiring

const server = new McpServer({ name: "ai-lab", version: "0.1.0" });
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

async function respond(fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    const isError = typeof result === "object" && result !== null && "error" in result;
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], ...(isError ? { isError: true } : {}) };
  } catch (e) {
    return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
  }
}

const sectionArg = z.string().min(1).max(20).describe('Section letter, e.g. "B" (sample sections are A, B and C)');
const skillArg = z.enum(SKILLS).describe("One of the four AI Fluency skills");

server.registerTool(
  "get_class_overview",
  {
    title: "Class overview",
    description: "Students in a section, average first-attempt and current pass rate per skill, and how many students are flagged as stuck. Sample data. Only sections the signed-in persona can see.",
    inputSchema: { section: sectionArg },
    annotations: readOnly,
  },
  ({ section }) => respond(() => classOverview(section)),
);

server.registerTool(
  "list_students_needing_help",
  {
    title: "Students needing help",
    description: "Students in a section who are stuck on one skill (pseudonymous IDs), each with their most-failed check and the pre-written 10-minute mini-lesson for it. Sample data.",
    inputSchema: { section: sectionArg, skill: skillArg },
    annotations: readOnly,
  },
  ({ section, skill }) => respond(() => needingHelp(section, skill)),
);

server.registerTool(
  "get_student_progress",
  {
    title: "Student progress",
    description: "One student's first vs current pass rate per skill and their recent attempts. Look up by pseudonymous ID (S-B-012) or by name; results only ever show the ID. Sample data.",
    inputSchema: { student: z.string().min(2).max(80).describe("Pseudonymous student ID like S-B-012, or part of a name") },
    annotations: readOnly,
  },
  ({ student }) => respond(() => studentProgress(student)),
);

server.registerTool(
  "get_exercise_stats",
  {
    title: "Exercise stats",
    description: "Pass rate per rubric check for one exercise, from the results the signed-in persona can see. Accepts an exercise ID (ps-ticket-summary) or part of its title. Sample data.",
    inputSchema: { exercise: z.string().min(2).max(80).describe("Exercise ID or part of its title") },
    annotations: readOnly,
  },
  ({ exercise }) => respond(() => exerciseStats(exercise)),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`ai-lab MCP server ready (persona ${PERSONA_KEY}, read-only).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
