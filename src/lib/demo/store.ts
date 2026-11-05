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
  /** True while the deterministic sample data is loading: those rows are never journaled. */
  seeding?: boolean;
  /** Changes made on this server since the last push to the shared log (see sync.ts). */
  journal: Change[];
  /** Stable row ids, so a change made on one server can be replayed on another. */
  byRid: Map<string, Row>;
}

/** One data change, replayable on any server that started from the same seed. */
export type Change =
  | { op: "i"; t: TableName; rows: Row[] }
  | { op: "u"; t: TableName; rid: string; patch: Row }
  | { op: "d"; t: TableName; rid: string };

const RID = "_rid";

/** A row's stable id. Hidden (non-enumerable), so it never shows up in query results. */
export function ridOf(r: Row): string {
  return (r as Record<string, unknown>)[RID] as string;
}

function setRid(s: Store, r: Row, rid: string) {
  Object.defineProperty(r, RID, { value: rid, enumerable: false, writable: true, configurable: true });
  s.byRid.set(rid, r);
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
    journal: [],
    byRid: new Map(),
  };
}

/** Insert rows with defaults applied; returns the stored rows. */
export function insertRows(s: Store, table: TableName, rows: Row[]): Row[] {
  const out: Row[] = [];
  for (const r of rows) {
    const full = { ...(DEFAULTS[table]?.(s) ?? {}), ...stripUndefined(r) };
    // Seed rows get deterministic ids (every server seeds identically); new rows get random ones.
    setRid(s, full, s.seeding ? `${table}:${s.tables[table].length}` : randomUUID());
    s.tables[table].push(full);
    out.push(full);
  }
  if (!s.seeding && out.length) s.journal.push({ op: "i", t: table, rows: out.map((r) => ({ ...r, [RID]: ridOf(r) })) });
  return out;
}

/** Update one row in place and journal the change. Use this for every write to an existing row. */
export function patchRow(s: Store, table: TableName, row: Row, patch: Row) {
  Object.assign(row, patch);
  if (!s.seeding) s.journal.push({ op: "u", t: table, rid: ridOf(row), patch });
}

/** Delete rows and journal the change. */
export function deleteRows(s: Store, table: TableName, rows: Row[]) {
  if (!rows.length) return;
  const gone = new Set(rows);
  s.tables[table] = s.tables[table].filter((r) => !gone.has(r));
  for (const r of rows) {
    s.byRid.delete(ridOf(r));
    if (!s.seeding) s.journal.push({ op: "d", t: table, rid: ridOf(r) });
  }
}

/** Replay changes made on another server. Idempotent for inserts. */
export function applyChanges(s: Store, changes: Change[]) {
  for (const c of changes) {
    if (c.op === "i") {
      for (const raw of c.rows) {
        const rid = raw[RID] as string;
        if (!rid || s.byRid.has(rid)) continue;
        const row = { ...raw };
        delete row[RID];
        setRid(s, row, rid);
        s.tables[c.t].push(row);
        if (typeof row.id === "number") s.seq[c.t] = Math.max(s.seq[c.t] ?? 0, row.id);
      }
    } else if (c.op === "u") {
      const row = s.byRid.get(c.rid);
      if (row) Object.assign(row, c.patch);
    } else {
      const row = s.byRid.get(c.rid);
      if (row) {
        s.tables[c.t] = s.tables[c.t].filter((r) => r !== row);
        s.byRid.delete(c.rid);
      }
    }
  }
}

function stripUndefined(r: Row): Row {
  return Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined));
}
