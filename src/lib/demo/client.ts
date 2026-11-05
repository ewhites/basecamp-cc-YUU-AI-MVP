import { getStore } from "./instance";
import { insertRows, type Row, type Store, type TableName } from "./store";

/**
 * A small, Supabase-shaped query client over the in-memory demo store.
 * It implements only what the app uses: select (with embeds and counts), filters, order,
 * range/limit, single, insert, update, and the database functions (rpc).
 *
 * Access rules are the same as the Postgres row-level security policies in
 * supabase/migrations: a user client only ever sees rows its role allows; only the
 * service client can write tables directly; staff actions go through rpc() with the same checks.
 */

export type Actor = { kind: "service" } | { kind: "anon" } | { kind: "user"; uid: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Result<D = any[]> = { data: D | null; error: { message: string; code?: string } | null; count: number | null };

interface Ctx {
  uid: string;
  role: string | null;
  studentId: string | null;
  sections: string[];
}

/** Lookup indexes, rebuilt only when a table they cover changes size. */
const indexCache = new WeakMap<Store, { key: string; attempt: Map<unknown, Row>; student: Map<unknown, Row> }>();
function idx(s: Store) {
  const key = `${s.tables.attempts.length}:${s.tables.students.length}`;
  let i = indexCache.get(s);
  if (!i || i.key !== key) {
    i = { key, attempt: new Map(s.tables.attempts.map((r) => [r.id, r])), student: new Map(s.tables.students.map((r) => [r.id, r])) };
    indexCache.set(s, i);
  }
  return i;
}

const ctxCache = new WeakMap<Store, Map<string, Ctx>>();
function ctxFor(s: Store, uid: string): Ctx {
  const key = `${uid}:${s.tables.profiles.length}:${s.tables.students.length}:${s.tables.section_instructors.length}`;
  let m = ctxCache.get(s);
  if (!m) ctxCache.set(s, (m = new Map()));
  const hit = m.get(key);
  if (hit) return hit;
  const role = (s.tables.profiles.find((p) => p.id === uid)?.role as string | undefined) ?? null;
  const studentId = (s.tables.students.find((st) => st.user_id === uid)?.id as string | undefined) ?? null;
  const sections = s.tables.section_instructors.filter((r) => r.instructor_id === uid).map((r) => r.section_id as string);
  const c = { uid, role, studentId, sections };
  m.set(key, c);
  return c;
}

function canSeeStudent(s: Store, c: Ctx, sid: unknown): boolean {
  const st = idx(s).student.get(sid);
  if (!st) return false;
  return st.user_id === c.uid || (c.role === "instructor" && c.sections.includes(st.section_id as string));
}

/** Row-level security, ported from the SQL policies. */
function visible(s: Store, actor: Actor, table: TableName, row: Row): boolean {
  if (actor.kind === "service") return true;
  if (actor.kind === "anon") return false;
  const c = ctxFor(s, actor.uid);
  switch (table) {
    case "profiles":
      return row.id === c.uid || c.role === "admin";
    case "sections":
    case "exercises":
      return true;
    case "section_instructors":
      return row.instructor_id === c.uid || c.role === "admin";
    case "students":
      return canSeeStudent(s, c, row.id);
    case "attempts":
      return canSeeStudent(s, c, row.student_id);
    case "check_results": {
      const a = idx(s).attempt.get(row.attempt_id);
      return !!a && canSeeStudent(s, c, a.student_id);
    }
    case "rubric_checks":
      return row.status === "published" || c.role === "curriculum" || c.role === "admin";
    case "audit_log":
    case "usage_ledger":
      return c.role === "admin";
    case "safety_flags":
      return c.role === "admin" || (c.role === "instructor" && canSeeStudent(s, c, row.student_id));
    case "eval_runs":
    case "eval_results":
      return c.role === "admin" || c.role === "curriculum";
    case "program_rollups":
      return c.role === "admin" || c.role === "curriculum" || c.role === "instructor";
  }
}

// ---------------------------------------------------------------- select parsing

interface Embed { name: string; inner: boolean; cols: Item[] }
type Item = { col: string } | Embed;

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseSelect(s: string): Item[] {
  return splitTop(s).map((part) => {
    const m = part.match(/^([a-z_]+)(!inner)?\((.*)\)$/s);
    if (m) return { name: m[1]!, inner: !!m[2], cols: parseSelect(m[3]!) };
    return { col: part };
  });
}

/** Foreign-key relations used by embeds. */
const RELATIONS: Record<string, Record<string, { table: TableName; local: string; foreign: string; many: boolean }>> = {
  check_results: { attempts: { table: "attempts", local: "attempt_id", foreign: "id", many: false } },
  attempts: { check_results: { table: "check_results", local: "id", foreign: "attempt_id", many: true } },
  section_instructors: { sections: { table: "sections", local: "section_id", foreign: "id", many: false } },
};

function project(s: Store, actor: Actor, table: TableName, row: Row, items: Item[]): Row | null {
  const out: Row = {};
  for (const it of items) {
    if ("col" in it) {
      if (it.col === "*") Object.assign(out, row);
      else out[it.col] = row[it.col] ?? null;
      continue;
    }
    const rel = RELATIONS[table]?.[it.name];
    if (!rel) throw new Error(`demo db: no relation ${table} -> ${it.name}`);
    const pool =
      rel.foreign === "id" && rel.table === "attempts" ? [idx(s).attempt.get(row[rel.local])].filter(Boolean) as Row[]
      : rel.many ? (childIndex(s, rel.table, rel.foreign).get(row[rel.local]) ?? [])
      : s.tables[rel.table].filter((r) => r[rel.foreign] === row[rel.local]);
    const related = pool.filter((r) => visible(s, actor, rel.table, r));
    if (rel.many) {
      out[it.name] = related.map((r) => project(s, actor, rel.table, r, it.cols));
      if (it.inner && related.length === 0) return null;
    } else {
      const one = related[0];
      if (!one) {
        if (it.inner) return null;
        out[it.name] = null;
      } else out[it.name] = project(s, actor, rel.table, one, it.cols);
    }
  }
  return out;
}

const childCache = new WeakMap<Store, Map<string, { n: number; map: Map<unknown, Row[]> }>>();
function childIndex(s: Store, table: TableName, fk: string): Map<unknown, Row[]> {
  let m = childCache.get(s);
  if (!m) childCache.set(s, (m = new Map()));
  const k = `${table}.${fk}`;
  const hit = m.get(k);
  if (hit && hit.n === s.tables[table].length) return hit.map;
  const map = new Map<unknown, Row[]>();
  for (const r of s.tables[table]) {
    const list = map.get(r[fk]) ?? [];
    list.push(r);
    map.set(r[fk], list);
  }
  m.set(k, { n: s.tables[table].length, map });
  return map;
}

function getPath(row: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Row)[k] : undefined), row);
}

function likeToRegex(pattern: string): RegExp {
  return new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$");
}

const cmp = (a: unknown, b: unknown) => (a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : (a as never) < (b as never) ? -1 : 1);

// ---------------------------------------------------------------- query builder

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Query<D = any[]> implements PromiseLike<Result<D>> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private cols = "*";
  private countMode = false;
  private head = false;
  private returning = false;
  private filters: { path: string; test: (v: unknown) => boolean }[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private from_ = 0;
  private to_: number | null = null;
  private single_: "single" | "maybe" | null = null;
  private payload: Row[] | Row | null = null;

  constructor(private s: Store, private actor: Actor, private table: TableName) {}

  select(cols = "*", opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    if (this.op !== "select") { this.returning = true; this.cols = cols; return this; }
    this.cols = cols;
    this.countMode = !!opts?.count;
    this.head = !!opts?.head;
    return this;
  }
  insert(rows: Row | Row[]) { this.op = "insert"; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(values: Row) { this.op = "update"; this.payload = values; return this; }
  delete() { this.op = "delete"; return this; }

  private where(path: string, test: (v: unknown) => boolean) { this.filters.push({ path, test }); return this; }
  eq(col: string, v: unknown) { return this.where(col, (x) => x === v); }
  neq(col: string, v: unknown) { return this.where(col, (x) => x !== v); }
  in(col: string, vs: unknown[]) { return this.where(col, (x) => vs.includes(x)); }
  like(col: string, p: string) { const re = likeToRegex(p); return this.where(col, (x) => typeof x === "string" && re.test(x)); }
  ilike(col: string, p: string) { const re = new RegExp(likeToRegex(p).source, "i"); return this.where(col, (x) => typeof x === "string" && re.test(x)); }
  gte(col: string, v: unknown) { return this.where(col, (x) => x !== null && x !== undefined && cmp(x, v) >= 0); }
  gt(col: string, v: unknown) { return this.where(col, (x) => x !== null && x !== undefined && cmp(x, v) > 0); }
  lte(col: string, v: unknown) { return this.where(col, (x) => x !== null && x !== undefined && cmp(x, v) <= 0); }
  lt(col: string, v: unknown) { return this.where(col, (x) => x !== null && x !== undefined && cmp(x, v) < 0); }
  is(col: string, v: null | boolean) { return this.where(col, (x) => (v === null ? x === null || x === undefined : x === v)); }
  not(col: string, op: string, v: unknown) {
    if (op === "is") return this.where(col, (x) => (v === null ? x !== null && x !== undefined : x !== v));
    if (op === "eq") return this.where(col, (x) => x !== v);
    throw new Error(`demo db: not(${op}) unsupported`);
  }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.to_ = this.from_ + n - 1; return this; }
  range(from: number, to: number) { this.from_ = from; this.to_ = to; return this; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  single(): Query<any> { this.single_ = "single"; return this as unknown as Query<any>; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maybeSingle(): Query<any> { this.single_ = "maybe"; return this as unknown as Query<any>; }

  then<A = Result<D>, B = never>(ok?: ((v: Result<D>) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    let r: Result<D>;
    try {
      r = this.run();
    } catch (e) {
      r = { data: null, error: { message: e instanceof Error ? e.message : String(e) }, count: null };
    }
    return Promise.resolve(r).then(ok, fail);
  }

  private matches(row: Row) {
    return this.filters.every((f) => f.test(getPath(row, f.path)));
  }

  private run(): Result<D> {
    const { s, actor, table } = this;
    if (this.op !== "select") {
      if (actor.kind !== "service") return { data: null, error: { message: `new row violates row-level security policy for table "${table}"` }, count: null };
      if (this.op === "insert") {
        const rows = insertRows(s, table, this.payload as Row[]);
        return this.finish(this.returning ? rows.map((r) => project(s, actor, table, r, parseSelect(this.cols))!) : null, rows.length);
      }
      const hit = s.tables[table].filter((r) => this.matches(r));
      if (this.op === "update") for (const r of hit) Object.assign(r, this.payload);
      else s.tables[table] = s.tables[table].filter((r) => !hit.includes(r));
      return this.finish(this.returning ? hit.map((r) => project(s, actor, table, r, parseSelect(this.cols))!) : null, hit.length);
    }

    const items = parseSelect(this.cols);
    let rows: Row[] = [];
    for (const r of s.tables[table]) {
      if (!visible(s, actor, table, r)) continue;
      // Project every base column (filters may use columns that aren't selected) plus the embeds.
      const p = project(s, actor, table, r, [{ col: "*" }, ...items.filter((i) => !("col" in i))]);
      if (!p || !this.matches(p)) continue;
      rows.push(p);
    }
    for (const o of [...this.orders].reverse()) rows.sort((a, b) => (o.asc ? 1 : -1) * cmp(a[o.col], b[o.col]));
    const count = rows.length;
    rows = rows.slice(this.from_, this.to_ === null ? undefined : this.to_ + 1);
    // Strip the helper columns we added for filtering.
    const wanted = new Set(items.map((i) => ("col" in i ? i.col : i.name)));
    const starred = wanted.has("*");
    rows = rows.map((r) => (starred ? r : Object.fromEntries(Object.entries(r).filter(([k]) => wanted.has(k)))));
    return this.finish(this.head ? null : rows, this.countMode ? count : null);
  }

  private finish(data: Row[] | null, count: number | null): Result<D> {
    type R = Result<D>;
    if (this.single_ && data) {
      if (data.length === 1) return { data: data[0], error: null, count } as R;
      if (data.length === 0 && this.single_ === "maybe") return { data: null, error: null, count };
      return { data: null, error: { message: data.length === 0 ? "JSON object requested, multiple (or no) rows returned" : "multiple rows returned" }, count };
    }
    return { data, error: null, count } as R;
  }
}

// ---------------------------------------------------------------- database functions (rpc)

class RpcError extends Error {}
const deny = (msg = "not allowed") => { throw new RpcError(msg); };

function audit(s: Store, c: Ctx, action: string, target: string | null, reason: string | null = null) {
  insertRows(s, "audit_log", [{ actor: c.uid, actor_role: c.role, action, target, reason }]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RPCS: Record<string, (s: Store, c: Ctx, a: Record<string, any>) => unknown> = {
  log_attempt_view(s, c, a) {
    const at = s.tables.attempts.find((x) => x.id === a.p_attempt);
    if (!at || !canSeeStudent(s, c, at.student_id)) deny();
    if (c.role !== "student") audit(s, c, "view_attempt", String(a.p_attempt));
    return null;
  },
  override_check(s, c, a) {
    if (c.role !== "instructor") deny("only instructors can override");
    if (!String(a.p_note ?? "").trim()) deny("a note is required");
    const at = s.tables.attempts.find((x) => x.id === a.p_attempt);
    if (!at || !canSeeStudent(s, c, at.student_id)) deny();
    const row = s.tables.check_results.find((r) => r.attempt_id === a.p_attempt && r.check_key === a.p_key);
    if (!row) deny("no such check");
    Object.assign(row!, { pass: !!a.p_pass, overridden: true, override_note: a.p_note, overridden_by: c.uid, overridden_at: new Date().toISOString(), needs_review: false });
    const rs = s.tables.check_results.filter((r) => r.attempt_id === a.p_attempt);
    at!.passed = rs.filter((r) => r.pass).length;
    at!.status = rs.some((r) => r.needs_review) ? "needs_review" : "scored";
    audit(s, c, "override_check", `${a.p_attempt}:${a.p_key}`, a.p_note);
    return null;
  },
  release_scores(s, c, a) {
    if (c.role !== "instructor" || !c.sections.includes(a.p_section)) deny();
    const ids = new Set(s.tables.students.filter((st) => st.section_id === a.p_section).map((st) => st.id));
    let n = 0;
    for (const at of s.tables.attempts) {
      if (ids.has(at.student_id) && at.released_at === null && at.status === "scored") { at.released_at = new Date().toISOString(); n++; }
    }
    audit(s, c, "release_scores", `section ${a.p_section}`, `${n} attempts sent to gradebook (simulated)`);
    return n;
  },
  admin_view_student_work(s, c, a) {
    if (c.role !== "admin") deny("admins only");
    if (String(a.p_reason ?? "").trim().length < 10) deny("a reason of at least 10 characters is required");
    audit(s, c, "admin_view_student_work", a.p_student, a.p_reason);
    return s.tables.attempts
      .filter((x) => x.student_id === a.p_student)
      .sort((x, y) => cmp(x.created_at, y.created_at))
      .map((x) => ({ attempt_id: x.id, exercise_id: x.exercise_id, attempt_no: x.attempt_no, status: x.status, passed: x.passed, total: x.total, input: x.input, created_at: x.created_at }));
  },
  curriculum_check_stats(s, c) {
    if (c.role !== "curriculum" && c.role !== "admin") deny();
    const attempts = new Map(s.tables.attempts.map((x) => [x.id, x]));
    const section = new Map(s.tables.students.map((x) => [x.id, x.section_id]));
    const agg = new Map<string, { exercise_id: string; check_key: string; skill: string; section_id: string; n: number; p: number }>();
    for (const r of s.tables.check_results) {
      const at = attempts.get(r.attempt_id);
      if (!at) continue;
      const sec = section.get(at.student_id) as string;
      const k = `${at.exercise_id}|${r.check_key}|${r.skill}|${sec}`;
      const g = agg.get(k) ?? { exercise_id: at.exercise_id as string, check_key: r.check_key as string, skill: r.skill as string, section_id: sec, n: 0, p: 0 };
      g.n++;
      if (r.pass) g.p++;
      agg.set(k, g);
    }
    return [...agg.values()].map((g) => ({ exercise_id: g.exercise_id, check_key: g.check_key, skill: g.skill, section_id: g.section_id, attempts: g.n, pass_rate: Math.round((g.p / g.n) * 10000) / 10000 }));
  },
  usage_by_cohort(s, c, a) {
    if (c.role !== "admin") deny("admins only");
    const section = new Map(s.tables.students.map((x) => [x.id, x.section_id]));
    const agg = new Map<string, { section_id: string; purpose: string; calls: number; tokens: number; cost_usd: number }>();
    for (const u of s.tables.usage_ledger) {
      if ((u.created_at as string) < a.p_since) continue;
      const sec = ((u.student_id && section.get(u.student_id)) || "staff/eval") as string;
      const k = `${sec}|${u.purpose}`;
      const g = agg.get(k) ?? { section_id: sec, purpose: u.purpose as string, calls: 0, tokens: 0, cost_usd: 0 };
      g.calls++;
      g.tokens += Number(u.input_tokens) + Number(u.output_tokens) + Number(u.cache_read_tokens) + Number(u.cache_write_tokens);
      g.cost_usd += Number(u.cost_usd);
      agg.set(k, g);
    }
    return [...agg.values()].map((g) => ({ ...g, cost_usd: Math.round(g.cost_usd * 10000) / 10000 }));
  },
  publish_rubric_draft(s, c, a) {
    if (c.role !== "curriculum" && c.role !== "admin") deny();
    const d = s.tables.rubric_checks.find((r) => r.id === a.p_draft && r.status === "draft");
    if (!d) deny("no such draft");
    if (!s.tables.eval_runs.some((r) => r.rubric_draft_id === a.p_draft && r.passed_gate)) deny("run the eval on this draft and pass the gate before publishing");
    for (const r of s.tables.rubric_checks) if (r.exercise_id === d!.exercise_id && r.key === d!.key && r.status === "published") r.status = "retired";
    d!.status = "published";
    audit(s, c, "publish_rubric", `${d!.exercise_id}:${d!.key} v${d!.version}`, "eval gate passed");
    return null;
  },
};

export class DemoClient {
  constructor(readonly actor: Actor, private s: Store = getStore()) {}
  from(table: TableName | string) {
    if (!(table in this.s.tables)) throw new Error(`demo db: unknown table ${table}`);
    return new Query(this.s, this.actor, table as TableName);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async rpc(name: string, args: Record<string, unknown> = {}): Promise<Result<any>> {
    const fn = RPCS[name];
    if (!fn) return { data: null, error: { message: `function ${name} does not exist` }, count: null };
    if (this.actor.kind === "anon") return { data: null, error: { message: `permission denied for function ${name}` }, count: null };
    const c: Ctx = this.actor.kind === "service" ? { uid: "service", role: "admin", studentId: null, sections: [] } : ctxFor(this.s, this.actor.uid);
    try {
      return { data: fn(this.s, c, args) ?? null, error: null, count: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : String(e) }, count: null };
    }
  }
}
