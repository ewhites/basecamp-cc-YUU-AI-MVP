/**
 * End-to-end check of the ai-lab MCP server: spawns it over stdio as different personas and
 * confirms row-level security shapes what each one sees. Needs local Supabase running and seeded.
 *
 *   npx tsx mcp/test-client.ts
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type Json = Record<string, unknown>;

let failures = 0;
function expectThat(ok: boolean, what: string, detail?: string) {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"} ${what}${detail ? `  (${detail})` : ""}`);
}

async function connect(personaKey: string) {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  env.LAB_MCP_PERSONA = personaKey;
  const transport = new StdioClientTransport({ command: "npx", args: ["tsx", "mcp/server.ts"], env, stderr: "pipe" });
  const client = new Client({ name: "ai-lab-test-client", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

async function call(client: Client, name: string, args: Json): Promise<{ isError: boolean; text: string; json: Json | null }> {
  const res = await client.callTool({ name, arguments: args });
  const content = (res.content ?? []) as { type: string; text?: string }[];
  const text = content.map((c) => c.text ?? "").join("");
  let json: Json | null = null;
  try {
    json = JSON.parse(text) as Json;
  } catch {
    json = null;
  }
  return { isError: Boolean(res.isError), text, json };
}

async function main() {
  // ---------------- instructor (Sections B and C)
  console.log("\n== as rivera (instructor, Sections B and C)");
  const rivera = await connect("rivera");
  const tools = await rivera.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  console.log(`  tools: ${names.join(", ")}`);
  expectThat(
    JSON.stringify(names) === JSON.stringify(["get_class_overview", "get_exercise_stats", "get_student_progress", "list_students_needing_help"]),
    "exactly the four read-only tools",
  );
  expectThat(tools.tools.every((t) => t.annotations?.readOnlyHint === true), "every tool is annotated read-only");

  const help = await call(rivera, "list_students_needing_help", { section: "B", skill: "description" });
  const stuck = ((help.json?.students as { student: string }[] | undefined) ?? []).map((s) => s.student).sort();
  console.log(`  list_students_needing_help(B, description) -> ${stuck.join(", ") || "(none)"}`);
  for (const s of (help.json?.students as Json[] | undefined) ?? []) {
    const c = s.mostFailedCheck as Json | null;
    console.log(`    ${s.student}: current ${s.currentPct}%, most-failed "${c?.key}" (${c?.failed}/${c?.of}); mini-lesson: ${String(s.miniLesson).slice(0, 70)}...`);
  }
  expectThat(JSON.stringify(stuck) === JSON.stringify(["S-B-003", "S-B-017", "S-B-029"]), "Section B stuck on Description = S-B-003, S-B-017, S-B-029");
  expectThat(!/"display_name"|Jasmine|Carter/.test(help.text), "no student names in the output");
  expectThat(((help.json?.students as Json[] | undefined) ?? []).every((s) => typeof s.miniLesson === "string" && (s.miniLesson as string).length > 20), "each flag carries a mini-lesson");

  const ovB = await call(rivera, "get_class_overview", { section: "B" });
  console.log(`  get_class_overview(B) -> students ${ovB.json?.students}, flags ${(ovB.json?.flags as Json | undefined)?.count}, description current ${((ovB.json?.skills as Json | undefined)?.description as Json | undefined)?.currentPct}%`);
  expectThat(ovB.json?.visible === true && ovB.json?.students === 40, "Section B overview shows 40 students");

  const ovA = await call(rivera, "get_class_overview", { section: "A" });
  console.log(`  get_class_overview(A) -> ${ovA.json?.message ?? ovA.text}`);
  expectThat(ovA.json?.visible === false && ovA.json?.students === undefined, "Section A (not hers) is empty: RLS blocks it");

  const pA = await call(rivera, "get_student_progress", { student: "S-A-011" });
  expectThat(pA.json?.visible === false, "cannot read a Section A student's progress", String(pA.json?.message ?? "").slice(0, 60));

  const ex = await call(rivera, "get_exercise_stats", { exercise: "ps-ticket-summary" });
  const exChecks = (ex.json?.checks as { key: string; passPct: number | null; results: number }[] | undefined) ?? [];
  console.log(`  get_exercise_stats(ps-ticket-summary) -> ${exChecks.map((c) => `${c.key} ${c.passPct}% (n=${c.results})`).join(", ")}`);
  expectThat(exChecks.length === 7 && exChecks.every((c) => c.results > 0), "exercise stats for all 7 checks");

  const bad = await call(rivera, "get_exercise_stats", { exercise: "no-such-exercise" });
  expectThat(bad.isError, "unknown exercise comes back as an MCP error");
  await rivera.close();

  // ---------------- student (only her own rows)
  console.log("\n== as jasmine (student S-B-012)");
  const jasmine = await connect("jasmine");
  const jB = await call(jasmine, "get_class_overview", { section: "B" });
  console.log(`  get_class_overview(B) -> students ${jB.json?.students}`);
  expectThat(jB.json?.students === 1, "sees exactly one student in her section (herself)");
  const jMe = await call(jasmine, "get_student_progress", { student: "S-B-012" });
  console.log(`  get_student_progress(S-B-012) -> ${(jMe.json?.recentAttempts as unknown[] | undefined)?.length ?? 0} recent attempts`);
  expectThat(jMe.json?.visible === true && jMe.json?.student === "S-B-012", "can read her own progress");
  const jOther = await call(jasmine, "get_student_progress", { student: "S-B-003" });
  expectThat(jOther.json?.visible === false, "cannot read a classmate's progress");
  const jHelp = await call(jasmine, "list_students_needing_help", { section: "B", skill: "description" });
  const jStuck = ((jHelp.json?.students as { student: string }[] | undefined) ?? []).map((s) => s.student);
  expectThat(jStuck.every((s) => s === "S-B-012"), "needing-help list never shows classmates", jStuck.join(", ") || "empty");
  const jEx = await call(jasmine, "get_exercise_stats", { exercise: "ps-meeting-recap" });
  const jRows = ((jEx.json?.checks as { results: number }[] | undefined) ?? []).reduce((n, c) => n + c.results, 0);
  console.log(`  get_exercise_stats(ps-meeting-recap) -> ${jRows} check results visible`);
  expectThat(jRows > 0 && jRows < 50, "exercise stats come only from her own attempts", `${jRows} results`);
  await jasmine.close();

  console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
  return failures ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  },
);
