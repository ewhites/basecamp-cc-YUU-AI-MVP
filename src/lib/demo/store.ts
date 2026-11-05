import { randomUUID } from "node:crypto";

/**
 * In-memory demo database. The deployed demo has no backend: every table lives in this
 * process, seeded with the same deterministic sample data on first use. New attempts last
 * until the server restarts (on Vercel, until the instance recycles).
 *
 * The schema mirrors supabase/migrations/*.sql, which remains the design for the pilot.
 */
export type Row = Record<string, unknown>;
export type TableName =
  | "profiles" | "sections" | "section_instructors" | "students" | "exercises" | "rubric_checks"
  | "attempts" | "check_results" | "audit_log" | "safety_flags" | "usage_ledger"
  | "eval_runs" | "eval_results" | "program_rollups" | "lesson_progress";

export interface Store {
  tables: Record<TableName, Row[]>;
  seq: Record<string, number>;
}

const now = () => new Date().toISOString();

/** Column defaults, matching the SQL schema. */
const DEFAULTS: Partial<Record<TableName, (s: Store) => Row>> = {
  attempts: () => ({ id: randomUUID(), output: {}, passed: null, total: null, tip: null, model: null, prompt_version: null, released_at: null, created_at: now() }),
  check_results: () => ({ coach_pass: null, evidence: "", evidence_verified: false, reason: "", needs_review: false, overridden: false, override_note: null, overridden_by: null, overridden_at: null }),
  audit_log: (s) => ({ id: next(s, "audit_log"), target: null, reason: null, created_at: now() }),
  safety_flags: (s) => ({ id: next(s, "safety_flags"), status: "open", created_at: now() }),
  usage_ledger: (s) => ({ id: next(s, "usage_ledger"), student_id: null, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: "0", created_at: now() }),
  rubric_checks: (s) => ({ id: next(s, "rubric_checks"), version: 1, method: "coach", status: "published", eval_run_id: null, created_by: null, created_at: now() }),
  eval_runs: () => ({ id: randomUUID(), rubric_draft_id: null, created_at: now() }),
  eval_results: () => ({ rep: 1 }),
  profiles: () => ({ created_at: now() }),
  lesson_progress: () => ({ created_at: now() }),
};

function next(s: Store, t: string): number {
  s.seq[t] = (s.seq[t] ?? 0) + 1;
  return s.seq[t];
}

export function emptyStore(): Store {
  return {
    tables: {
      profiles: [], sections: [], section_instructors: [], students: [], exercises: [], rubric_checks: [],
      attempts: [], check_results: [], audit_log: [], safety_flags: [], usage_ledger: [],
      eval_runs: [], eval_results: [], program_rollups: [], lesson_progress: [],
    },
    seq: {},
  };
}

/** Insert rows with defaults applied; returns the stored rows. */
export function insertRows(s: Store, table: TableName, rows: Row[]): Row[] {
  const out: Row[] = [];
  for (const r of rows) {
    const full = { ...(DEFAULTS[table]?.(s) ?? {}), ...stripUndefined(r) };
    s.tables[table].push(full);
    out.push(full);
  }
  return out;
}

function stripUndefined(r: Row): Row {
  return Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined));
}
