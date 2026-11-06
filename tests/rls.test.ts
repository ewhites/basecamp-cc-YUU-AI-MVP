/**
 * Access-rule tests for the demo data layer. The rules are ported from the Postgres row-level
 * security policies in supabase/migrations; these are the same assertions the RLS tests made.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { DemoClient } from "../src/lib/demo/client";
import { PERSONA_IDS } from "../src/lib/demo/sample";
import { resetStore } from "../src/lib/demo/instance";

type SupabaseClient = DemoClient;
const as = async (key: string): Promise<DemoClient> => new DemoClient({ kind: "user", uid: PERSONA_IDS[key]! });
const available = true;

const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
  const { count: n, error } = await q;
  if (error) throw error;
  return n ?? 0;
};

describe.skipIf(!available)("row-level security", () => {
  let jasmine: SupabaseClient, rivera: SupabaseClient, okafor: SupabaseClient, lee: SupabaseClient, anon: SupabaseClient;

  beforeAll(async () => {
    resetStore();
    [jasmine, rivera, okafor, lee] = (await Promise.all(["jasmine", "rivera", "okafor", "lee"].map(as))) as [SupabaseClient, SupabaseClient, SupabaseClient, SupabaseClient];
    anon = new DemoClient({ kind: "anon" });
    // Jasmine starts the course fresh; give her one scored attempt (written by the server) to test against.
    const service = new DemoClient({ kind: "service" });
    const { data: a } = await service
      .from("attempts")
      .insert({ student_id: "S-B-012", exercise_id: "sp-describe", studio: "check", attempt_no: 1, input: { studio: "check", answer: "x" }, status: "scored", passed: 1, total: 3 })
      .select("id")
      .single();
    await service.from("check_results").insert({ attempt_id: a!.id, check_key: "d_task_audience", skill: "description", pass: true });
    await service.from("lesson_progress").insert({ student_id: "S-B-001", step_id: "lesson-M01" });
  });

  it("a student sees only their own student row and attempts", async () => {
    expect(await count(jasmine.from("students").select("id", { count: "exact", head: true }))).toBe(1);
    expect(await count(jasmine.from("attempts").select("id", { count: "exact", head: true }).neq("student_id", "S-B-012"))).toBe(0);
    expect(await count(jasmine.from("attempts").select("id", { count: "exact", head: true }))).toBeGreaterThan(0);
    const { data: other } = await jasmine.from("check_results").select("attempt_id, attempts!inner(student_id)").neq("attempts.student_id", "S-B-012").limit(5);
    expect(other ?? []).toHaveLength(0);
  });

  it("a student sees only their own lesson progress", async () => {
    expect(await count(jasmine.from("lesson_progress").select("step_id", { count: "exact", head: true }))).toBe(0);
    expect(await count(rivera.from("lesson_progress").select("step_id", { count: "exact", head: true }))).toBe(1);
    const { error } = await jasmine.from("lesson_progress").insert({ student_id: "S-B-012", step_id: "lesson-M01" });
    expect(error).not.toBeNull();
  });

  it("a student cannot write or override their own score", async () => {
    const { error: ins } = await jasmine.from("check_results").insert({ attempt_id: "00000000-0000-4000-8000-000000000001", check_key: "x", skill: "description", pass: true });
    expect(ins).not.toBeNull();
    const { data: mine } = await jasmine.from("attempts").select("id").limit(1).single();
    const { error } = await jasmine.rpc("override_check", { p_attempt: mine!.id, p_key: "d_task_audience", p_pass: false, p_note: "self" });
    expect(error).not.toBeNull();
  });

  it("an instructor sees only their own sections", async () => {
    expect(await count(rivera.from("students").select("id", { count: "exact", head: true }).eq("section_id", "A"))).toBe(0);
    expect(await count(rivera.from("students").select("id", { count: "exact", head: true }))).toBe(80);
    expect(await count(rivera.from("attempts").select("id", { count: "exact", head: true }).like("student_id", "S-A-%"))).toBe(0);
    const { error } = await rivera.rpc("release_scores", { p_section: "A" });
    expect(error).not.toBeNull();
  });

  it("instructor overrides are audited and require a note", async () => {
    const { data: a } = await rivera.from("attempts").select("id").eq("student_id", "S-B-001").limit(1).single();
    const { error: noNote } = await rivera.rpc("override_check", { p_attempt: a!.id, p_key: "role", p_pass: true, p_note: " " });
    expect(noNote).not.toBeNull();
    const haddad = await as("haddad");
    const { error: wrongSection } = await haddad.rpc("override_check", { p_attempt: a!.id, p_key: "role", p_pass: true, p_note: "not my student" });
    expect(wrongSection).not.toBeNull();
  });

  it("only the student's own instructor can close a safety flag, with a note", async () => {
    const { data: f } = await rivera.from("safety_flags").select("id, status").eq("student_id", "S-C-021").single();
    expect(f!.status).toBe("open");
    expect((await jasmine.rpc("resolve_safety_flag", { p_flag: f!.id, p_note: "x" })).error).not.toBeNull();
    expect((await (await as("haddad")).rpc("resolve_safety_flag", { p_flag: f!.id, p_note: "not mine" })).error).not.toBeNull();
    expect((await rivera.rpc("resolve_safety_flag", { p_flag: f!.id, p_note: " " })).error).not.toBeNull();
    expect((await rivera.rpc("resolve_safety_flag", { p_flag: f!.id, p_note: "Checked in after class" })).error).toBeNull();
    const { data: after } = await rivera.from("safety_flags").select("status, resolution_note").eq("id", f!.id).single();
    expect(after).toMatchObject({ status: "resolved", resolution_note: "Checked in after class" });
    expect(await count(lee.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "resolve_safety_flag"))).toBe(1);
  });

  it("the curriculum designer never sees student names, only aggregates", async () => {
    expect(await count(okafor.from("students").select("id", { count: "exact", head: true }))).toBe(0);
    expect(await count(okafor.from("attempts").select("id", { count: "exact", head: true }))).toBe(0);
    const { data, error } = await okafor.rpc("curriculum_check_stats");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(Object.keys(data![0]!)).not.toContain("student_id");
  });

  it("an admin reads student work only through the logged break-glass function", async () => {
    expect(await count(lee.from("attempts").select("id", { count: "exact", head: true }))).toBe(0);
    const { error: noReason } = await lee.rpc("admin_view_student_work", { p_student: "S-B-001", p_reason: "x" });
    expect(noReason).not.toBeNull();
    const before = await count(lee.from("audit_log").select("id", { count: "exact", head: true }));
    const { data, error } = await lee.rpc("admin_view_student_work", { p_student: "S-B-001", p_reason: "RLS test: audited read" });
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(await count(lee.from("audit_log").select("id", { count: "exact", head: true }))).toBe(before + 1);
  });

  it("signed-out requests see nothing and cannot call functions", async () => {
    // Signed out: either an error (no execute grant on the RLS helper) or zero rows. Never data.
    const { data: rows, error: e1 } = await anon.from("attempts").select("id").limit(5);
    expect(e1 !== null || (rows ?? []).length === 0).toBe(true);
    const { error } = await anon.rpc("curriculum_check_stats");
    expect(error).not.toBeNull();
  });
});
