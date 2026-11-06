/** Two servers, one shared change log: a write on either server is visible on the other. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DemoClient } from "../src/lib/demo/client";
import { PERSONA_IDS, seedStore } from "../src/lib/demo/sample";
import { emptyStore, type Store } from "../src/lib/demo/store";

function seeded(): Store {
  const s = emptyStore();
  s.seeding = true;
  seedStore(s);
  s.seeding = false;
  return s;
}

// A fake Upstash REST endpoint: just enough of RPUSH and LRANGE.
const log: string[] = [];
let calls = 0;
const fakeFetch = vi.fn(async (_url: string, init: { body: string }) => {
  calls++;
  const cmds = JSON.parse(init.body) as (string | number)[][];
  const out = cmds.map(([cmd, , a, b]) => {
    if (cmd === "RPUSH") return { result: log.push(String(a)) };
    if (cmd === "LRANGE") return { result: log.slice(Number(a), Number(b) + 1) };
    return { error: `unsupported ${cmd}` };
  });
  return new Response(JSON.stringify(out), { status: 200 });
});

describe("shared change log across servers", () => {
  let a: Store, b: Store;
  beforeAll(() => {
    process.env.KV_REST_API_URL = "https://fake-upstash.example";
    process.env.KV_REST_API_TOKEN = "test-token";
    vi.stubGlobal("fetch", fakeFetch);
    a = seeded();
    b = seeded();
  });
  afterAll(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    vi.unstubAllGlobals();
  });

  it("seeds identically and does not log seed rows", () => {
    expect(a.byRid.size).toBe(b.byRid.size);
    expect(a.journal).toHaveLength(0);
    expect(log).toHaveLength(0);
  });

  it("an attempt saved on server A is visible to the student on server B", async () => {
    const svcA = new DemoClient({ kind: "service" }, a);
    const { data } = await svcA
      .from("attempts")
      .insert({ student_id: "S-B-012", exercise_id: "sp-describe", studio: "check", attempt_no: 1, input: { studio: "check", answer: "x" }, status: "scored", passed: 2, total: 3 })
      .select("id")
      .single();
    await svcA.from("check_results").insert({ attempt_id: data!.id, check_key: "d_task_audience", skill: "description", pass: true });
    expect(log.length).toBeGreaterThan(0);

    await new Promise((r) => setTimeout(r, 60));
    const jasmineOnB = new DemoClient({ kind: "user", uid: PERSONA_IDS.jasmine! }, b);
    const { data: mine } = await jasmineOnB.from("attempts").select("id, passed, check_results(check_key, pass)");
    expect(mine).toHaveLength(1);
    expect(mine![0]).toMatchObject({ id: data!.id, passed: 2, check_results: [{ check_key: "d_task_audience", pass: true }] });
    // The hidden row id never leaks into query results.
    expect(Object.keys(mine![0]!)).not.toContain("_rid");
  });

  it("an instructor override on server B shows up on server A, and access rules still apply", async () => {
    const riveraOnB = new DemoClient({ kind: "user", uid: PERSONA_IDS.rivera! }, b);
    const { data: at } = await riveraOnB.from("attempts").select("id").eq("student_id", "S-B-012").single();
    const { error } = await riveraOnB.rpc("override_check", { p_attempt: at!.id, p_key: "d_task_audience", p_pass: false, p_note: "Quote doesn't name the reader." });
    expect(error).toBeNull();

    await new Promise((r) => setTimeout(r, 60));
    const jasmineOnA = new DemoClient({ kind: "user", uid: PERSONA_IDS.jasmine! }, a);
    const { data: row } = await jasmineOnA.from("check_results").select("pass, overridden, override_note").single();
    expect(row).toMatchObject({ pass: false, overridden: true, override_note: "Quote doesn't name the reader." });
    const { data: attempt } = await jasmineOnA.from("attempts").select("passed").single();
    expect(attempt!.passed).toBe(0);
    // Section A's instructor still sees nothing of Section B, replayed rows included.
    const haddadOnA = new DemoClient({ kind: "user", uid: PERSONA_IDS.haddad! }, a);
    const { data: none } = await haddadOnA.from("attempts").select("id").eq("student_id", "S-B-012");
    expect(none).toHaveLength(0);
  });

  it("does not apply its own changes twice", async () => {
    const before = a.tables.audit_log.length;
    await new Promise((r) => setTimeout(r, 60));
    await new DemoClient({ kind: "service" }, a).from("audit_log").select("id");
    expect(a.tables.audit_log.length).toBe(before);
    expect(calls).toBeGreaterThan(0);
  });
});
