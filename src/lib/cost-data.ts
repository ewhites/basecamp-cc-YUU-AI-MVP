import "server-only";
import { userClient } from "./db";

/**
 * Reads for the daily limit (facilitator) and the cost view (admin). Every read goes through userClient(),
 * so the access rules in the data layer decide what each role sees. Nothing here filters by role.
 * Reports are totals only: no read here returns attempt text or model output.
 */

export interface CapOverride {
  id: number;
  student_id: string;
  daily_tokens: number;
  previous_tokens: number | null;
  reason: string;
  actor: string;
  created_at: string;
}

export interface CapStatus {
  default_tokens: number;
  daily_tokens: number;
  used_today: number;
  override: CapOverride | null;
}

export interface CostSummary {
  spend_usd: number;
  cap_usd: number;
  calls: number;
  tokens: { input: number; output: number; cache_read: number; cache_write: number };
  cache_hit_rate: number | null;
  active_students: number;
  students_total: number;
  top_spenders: { student_id: string; section_id: string; tokens: number; cost_usd: number; calls: number }[];
  by_model: { model: string; calls: number; input: number; output: number; cache_read: number; cache_write: number; cost_usd: number }[];
  top_lessons: { exercise_id: string; tokens: number; cost_usd: number; students: number }[];
}

/** Start of today, of this month and of the last 7 days, on the server's clock (the same clock budgetFor uses). */
export function periods(now = new Date()) {
  return {
    day: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    month: new Date(now.getFullYear(), now.getMonth(), 1),
    week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
  };
}

const COLS = "id, student_id, daily_tokens, previous_tokens, reason, actor, created_at";

/** One student's daily limit and today's use. Null when the access rules hide the student. */
export async function capStatus(studentId: string): Promise<CapStatus | null> {
  const db = await userClient();
  const { data, error } = await db.rpc("daily_cap_status", { p_student: studentId, p_since: periods().day.toISOString() });
  if (error) return null;
  return data as CapStatus;
}

/** Limit changes for these students, newest first. */
export async function overridesFor(studentIds: string[], limit = 20): Promise<CapOverride[]> {
  if (!studentIds.length) return [];
  const db = await userClient();
  const { data, error } = await db
    .from("cap_overrides")
    .select(COLS)
    .in("student_id", studentIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as CapOverride[];
}

/** Every limit change the viewer may see, newest first (admins: all). */
export async function overrideLog(limit = 50): Promise<CapOverride[]> {
  const db = await userClient();
  const { data, error } = await db.from("cap_overrides").select(COLS).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as CapOverride[];
}

/** Staff names the viewer may read (admins read every profile; others only their own). */
export async function staffNames(): Promise<Map<string, string>> {
  const db = await userClient();
  const { data } = await db.from("profiles").select("id, display_name");
  return new Map(((data ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
}

/** The admin cost view for this month. Throws for anyone but an admin (the data layer refuses). */
export async function costSummary(): Promise<CostSummary> {
  const db = await userClient();
  const p = periods();
  const { data, error } = await db.rpc("admin_cost_summary", { p_month_start: p.month.toISOString(), p_week_start: p.week.toISOString() });
  if (error) throw new Error(error.message);
  return data as CostSummary;
}

/** 90000 -> "90,000". */
export function tokens(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** 1234567 -> "1.2M", 45200 -> "45K". For dense tables. */
export function shortTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  return tokens(n);
}

/** Dollars with cents; under a dollar keeps four places so small per-student costs still read. */
export function usd(n: number): string {
  // Always cents, so the amounts line up. A non-zero amount under half a cent reads "under $0.01".
  return n > 0 && n < 0.005 ? "under $0.01" : `$${n.toFixed(2)}`;
}
