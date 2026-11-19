/** The Agent Builder tool sandbox: demo data, the least-privilege check, and the tool-use loop (mocked client, no network). */
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { coachSystemPrompt } from "../src/lib/coach/prompt";
import { finalizeGrade, type GradeResult } from "../src/lib/coach/grade";
import { transcriptText } from "../src/lib/coach/runner";
import { ALL_STEPS, COURSE } from "../src/lib/curriculum/course";
import { getExercise } from "../src/lib/curriculum/exercises";
import { DEMOS, panelsAt } from "../src/lib/sandbox/demos";
import { MAX_TOOL_ROUNDS, runSandboxBot, SANDBOX_MAX_TOKENS, type CreateFn } from "../src/lib/sandbox/run";
import {
  cleanTools,
  executeTool,
  knowledgeSheet,
  leastPrivilege,
  searchSheet,
  TOOL_DEFS,
  TOOL_IDS,
  TOOLS_CHECK,
  toolsCheckOutcome,
  withToolsCheck,
  type ToolId,
} from "../src/lib/sandbox/tools";
import { loadGradingCases } from "../src/lib/evals/datasets";

const ex = getExercise("ab-newhire-it")!;

describe("scripted demos", () => {
  it("are two, named in the course map, in order: research assistant then travel planner", () => {
    expect(DEMOS.map((d) => d.title)).toEqual(["Research assistant", "Travel planner"]);
    const stepIds = COURSE.find((g) => g.id === "M03")!.steps.filter((s) => s.kind === "demo").map((s) => s.id);
    expect(stepIds).toEqual(DEMOS.map((d) => d.id));
    for (const d of DEMOS) expect(ALL_STEPS.find((s) => s.id === d.id)?.href).toBe(`/lab/lesson/m3/${d.slug}`);
  });

  it.each(DEMOS.map((d) => [d.title, d] as const))("%s: every step has a short reasoning line, and every tool call uses a tool the agent has", (_n, d) => {
    expect(d.steps.length).toBeGreaterThanOrEqual(4);
    expect(new Set(d.steps.map((s) => s.id)).size).toBe(d.steps.length);
    for (const s of d.steps) {
      expect(s.reasoning.length, s.id).toBeGreaterThan(10);
      expect(s.reasoning.length, s.id).toBeLessThanOrEqual(200);
      if (s.call) {
        expect(d.tools, `${s.id} uses ${s.call.tool}`).toContain(s.call.tool);
        expect(s.call.name).toBe(TOOL_DEFS[s.call.tool].name);
        expect(s.call.result.length).toBeGreaterThan(0);
        expect(Object.keys(s.call.input).length).toBeGreaterThan(0);
      }
    }
  });

  it.each(DEMOS.map((d) => [d.title, d] as const))("%s: has exactly one outbox draft that waits for approval, as the last step, and an agent revision", (_n, d) => {
    const gated = d.steps.filter((s) => s.draft);
    expect(gated).toHaveLength(1);
    expect(d.steps.at(-1)).toBe(gated[0]);
    expect(gated[0]!.call?.tool).toBe("outbox");
    expect(gated[0]!.call?.result).toMatch(/waiting for a person to approve/i);
    expect(gated[0]!.draft!.revised.body).not.toBe(gated[0]!.draft!.body);
    expect(gated[0]!.draft!.revised.reasoning.length).toBeGreaterThan(10);
    expect(d.sent).toMatch(/^Sent \(simulated\)/);
  });

  it.each(DEMOS.map((d) => [d.title, d] as const))("%s: ends with the three teaching points", (_n, d) => {
    expect(d.teach.map((t) => t.title)).toEqual(["Context, reasoning, tools", "Least privilege", "A person approves"]);
    for (const t of d.teach) expect(t.text.length).toBeGreaterThan(20);
  });

  it("research assistant has all four tools and updates notes and memory; travel planner has the sheet and outbox only", () => {
    const [research, travel] = DEMOS;
    expect(research!.tools).toEqual(["sheet", "outbox", "notes", "memory"]);
    expect(research!.steps.some((s) => s.call?.tool === "notes")).toBe(true);
    expect(research!.steps.some((s) => s.call?.tool === "memory")).toBe(true);
    expect(travel!.tools).toEqual(["sheet", "outbox"]);
    expect(travel!.steps.some((s) => s.call?.tool === "notes" || s.call?.tool === "memory")).toBe(false);
    // Least privilege is said out loud: it cannot book, because it has no booking tool.
    expect(travel!.steps.some((s) => /cannot/i.test(s.reasoning) && /no booking tool/i.test(s.reasoning))).toBe(true);
  });

  it("panels grow as steps are revealed, and the outbox holds the revised draft after Send back", () => {
    const d = DEMOS[0]!;
    const empty = panelsAt(d, 0, false);
    expect(empty).toEqual({ sheetRead: false, notes: [], memory: [], draft: null });
    const all = panelsAt(d, d.steps.length, false);
    expect(all.sheetRead).toBe(true);
    expect(all.notes.length).toBeGreaterThan(0);
    expect(all.memory.length).toBeGreaterThan(0);
    expect(all.draft?.body).toBe(d.steps.at(-1)!.draft!.body);
    expect(panelsAt(d, d.steps.length, true).draft?.body).toBe(d.steps.at(-1)!.draft!.revised.body);
    // before the draft step, no draft
    expect(panelsAt(d, d.steps.length - 1, false).draft).toBeNull();
  });
});

describe("tools and the least-privilege check", () => {
  const all = (): ToolId[][] => {
    const out: ToolId[][] = [];
    for (let m = 0; m < 16; m++) out.push(TOOL_IDS.filter((_, i) => m & (1 << i)));
    return out;
  };

  it("passes only when the spreadsheet and the outbox are chosen and notes and memory are not", () => {
    for (const tools of all()) {
      const expected = tools.length === 2 && tools.includes("sheet") && tools.includes("outbox");
      expect(leastPrivilege(tools), tools.join()).toBe(expected);
      const o = toolsCheckOutcome(tools);
      expect(o.pass).toBe(expected);
      expect(o).toMatchObject({ key: "least_privilege_tools", skill: "responsible", method: "code", coachPass: null, needsReview: false, evidenceVerified: true });
      expect(o.reason.length).toBeGreaterThan(0);
    }
    expect(toolsCheckOutcome(["sheet", "outbox", "memory"]).reason).toMatch(/Memory is not needed/);
    expect(toolsCheckOutcome([]).reason).toMatch(/cannot read the IT guide/);
  });

  it("is decided in code: not in the exercise's checks, never in the coach prompt, never labeled", () => {
    expect(TOOLS_CHECK.method).toBe("code");
    expect(ex.checks.some((c) => c.key === TOOLS_CHECK.key)).toBe(false);
    const prompt = coachSystemPrompt(ex);
    expect(prompt).not.toContain(TOOLS_CHECK.key);
    expect(prompt).not.toContain(TOOLS_CHECK.text);
    for (const c of loadGradingCases()) expect(Object.keys(c.labels)).not.toContain(TOOLS_CHECK.key);
  });

  it("finalizeGrade (unchanged) still grades the exercise with the coach's checks only", () => {
    const raw = { checks: ex.checks.map((c) => ({ key: c.key, evidence: "", pass: false, reason: "x" })), tip: "t" };
    const g = finalizeGrade(ex, raw, { attempt: "a", output: "o" });
    expect(g.total).toBe(ex.checks.length);
    expect(g.checks.map((c) => c.key)).not.toContain(TOOLS_CHECK.key);
  });

  it("withToolsCheck adds one check at the end and moves the score, leaving the coach's own checks as they were", () => {
    const base = { checks: [{ key: "job", pass: true }], tip: "t", passed: 5, total: 7, needsReview: false } as unknown as GradeResult;
    const good = withToolsCheck(base, ["sheet", "outbox"]);
    expect([good.passed, good.total]).toEqual([6, 8]);
    expect(good.checks.at(-1)!.key).toBe(TOOLS_CHECK.key);
    expect(good.checks[0]).toBe(base.checks[0]);
    const bad = withToolsCheck(base, ["sheet", "outbox", "notes"]);
    expect([bad.passed, bad.total]).toEqual([5, 8]);
    expect(base.total).toBe(7);
  });

  it("cleanTools keeps only the four known ids, once each, in order", () => {
    expect(cleanTools(["memory", "sheet", "sheet", "bogus", 7, "outbox"])).toEqual(["sheet", "outbox", "memory"]);
    expect(cleanTools(undefined)).toEqual([]);
    expect(cleanTools("sheet")).toEqual([]);
  });

  it("turns the IT guide into one sheet row per topic", () => {
    const sheet = knowledgeSheet("IT guide", ex.knowledge!);
    expect(sheet.rows).toHaveLength(7);
    expect(sheet.rows.map((r) => r[0])).toEqual(["Wi-Fi", "First login", "Printers", "VPN", "Password resets and lockouts", "Admin rights", "IT Service Desk"]);
    expect(searchSheet(sheet, "wifi").map((r) => r[0])).toEqual(["Wi-Fi"]);
    expect(searchSheet(sheet, "").length).toBe(7);
    expect(searchSheet(sheet, "payroll")).toEqual([]);
  });

  it("only runs tools that were given, and caps drafts per message", () => {
    const sheet = knowledgeSheet("IT guide", ex.knowledge!);
    const refused = executeTool("write_note", { text: "x" }, ["sheet"], sheet);
    expect(refused.isError).toBe(true);
    expect(refused.event).toBeUndefined();
    expect(executeTool("nope", {}, ["sheet"], sheet).isError).toBe(true);
    const counts = {};
    for (let i = 0; i < 3; i++) expect(executeTool("draft_email", { to: "a", subject: "s", body: "b" }, ["outbox"], sheet, counts).isError).toBe(false);
    expect(executeTool("draft_email", { to: "a", subject: "s", body: "b" }, ["outbox"], sheet, counts).isError).toBe(true);
    expect(executeTool("draft_email", { to: "", subject: "s", body: "" }, ["outbox"], sheet).isError).toBe(true);
  });
});

// ---------------------------------------------------------------- run.ts with a mocked client

type Block = Anthropic.Beta.BetaContentBlock;
function reply(content: Block[], stop: string, usage = { input_tokens: 100, output_tokens: 20 }) {
  return { id: "msg", type: "message", role: "assistant", model: "claude-haiku-5-5", content, stop_reason: stop, stop_sequence: null, usage } as unknown as Anthropic.Beta.BetaMessage;
}
const text = (t: string) => ({ type: "text", text: t, citations: null }) as unknown as Block;
const use = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input }) as unknown as Block;

/** The text of the last tool_result the model was shown, or "". */
function lastToolResult(p: Parameters<CreateFn>[0]): string {
  const last = p.messages.at(-1);
  if (!last?.content || typeof last.content === "string") return "";
  const r = last.content.find((b) => b.type === "tool_result") as { content?: string } | undefined;
  return r?.content ?? "";
}

describe("runSandboxBot (mocked client)", () => {
  it("offers only the chosen tools, lets the bot read the guide through the spreadsheet, and leaves the guide out of the system prompt", async () => {
    const create = vi.fn<CreateFn>(async (p) => {
      const msgs = p.messages.length;
      if (msgs === 1) return reply([use("t1", "search_sheet", { query: "wifi" })], "tool_use");
      return reply([text(`Guide says: ${lastToolResult(p)}`)], "end_turn");
    });
    const run = await runSandboxBot("You help new hires with IT.", ex, ["sheet", "outbox"], create);
    // 3 coworker messages x (1 tool call + 1 answer)
    expect(create).toHaveBeenCalledTimes(6);
    expect(run.calls).toHaveLength(6);
    const first = create.mock.calls[0]![0];
    expect(first.system).toBe("You help new hires with IT.");
    expect(JSON.stringify(first)).not.toContain("BL-Staff");
    expect((first.tools as { name: string }[]).map((t) => t.name)).toEqual(["search_sheet", "draft_email"]);
    expect(first.max_tokens).toBe(SANDBOX_MAX_TOKENS);
    expect(first.model).toBe("claude-haiku-5-5");
    // no sampling parameters
    for (const k of ["temperature", "top_p", "top_k"]) expect(k in first).toBe(false);
    // the bot got the guide row back from the pretend spreadsheet
    expect(run.turns[0]!.reply.text).toContain("BL-Staff");
    expect(run.sandbox.sheet?.lookups.map((l) => l.messageId)).toEqual(["normal", "tricky", "out_of_scope"]);
    expect(run.sandbox.sheet?.lookups[0]).toMatchObject({ query: "wifi", found: 1 });
    expect(run.sandbox.calls).toBe(6);
    // the coach's transcript format is unchanged
    const t = transcriptText(run.turns);
    expect(t).toMatch(/^\[normal\] Aisha \(new hire, Finance\): Hi! First day\. How do I get on the Wi-Fi\?\nBot: Guide says:/);
    expect(t).toContain("[tricky] Ben (new hire, Sales):");
    expect(t).toContain("[out_of_scope] Carla (new hire, Warehouse):");
  });

  it("offers no tools at all when none are chosen, so the bot cannot see the guide", async () => {
    const create = vi.fn<CreateFn>(async () => reply([text("I do not know.")], "end_turn"));
    const run = await runSandboxBot("Be helpful.", ex, [], create);
    expect(create).toHaveBeenCalledTimes(3);
    for (const [p] of create.mock.calls) {
      expect("tools" in p).toBe(false);
      expect(p.system).toBe("Be helpful.");
      expect(JSON.stringify(p)).not.toContain("BL-Staff");
    }
    expect(run.sandbox).toMatchObject({ tools: [], outbox: [], notes: [], memory: [], calls: 3 });
    expect(run.sandbox.sheet).toBeUndefined();
  });

  it("stores an outbox draft as waiting, with the message it answered, and nothing leaves the run", async () => {
    const create = vi.fn<CreateFn>(async (p) => {
      if (p.messages.length === 1) return reply([use("d1", "draft_email", { to: "it-help@brightline.example", subject: "Admin request", body: "Ben asks for admin rights." })], "tool_use");
      return reply([text("I drafted a ticket for the IT Service Desk.")], "end_turn");
    });
    const run = await runSandboxBot("Help.", ex, ["outbox"], create);
    expect(run.sandbox.outbox).toHaveLength(3);
    expect(run.sandbox.outbox.map((d) => d.id)).toEqual(["D1", "D2", "D3"]);
    expect(run.sandbox.outbox.map((d) => d.messageId)).toEqual(["normal", "tricky", "out_of_scope"]);
    expect(run.sandbox.outbox[0]).toMatchObject({ to: "it-help@brightline.example", subject: "Admin request" });
    // the tool result tells the model nothing was sent
    const second = create.mock.calls.find(([p]) => p.messages.length === 3)![0];
    expect(lastToolResult(second)).toMatch(/Nothing was sent/);
  });

  it("refuses a tool the student did not give, and records nothing for it", async () => {
    const create = vi.fn<CreateFn>(async (p) => {
      if (p.messages.length === 1) return reply([use("n1", "write_note", { text: "secret" })], "tool_use");
      return reply([text(lastToolResult(p))], "end_turn");
    });
    const run = await runSandboxBot("Help.", ex, ["sheet"], create);
    expect(run.sandbox.notes).toEqual([]);
    expect(run.turns[0]!.reply.text).toMatch(/do not have a tool called write_note/);
    const sent = create.mock.calls.find(([p]) => p.messages.length === 3)![0].messages.at(-1)!.content as { is_error?: boolean }[];
    expect(sent[0]!.is_error).toBe(true);
  });

  it("stops after three tool rounds: the fourth call must answer in words", async () => {
    const create = vi.fn<CreateFn>(async (p) => {
      if (p.tool_choice && (p.tool_choice as { type: string }).type === "none") return reply([text("Final answer.")], "end_turn");
      return reply([use(`t${p.messages.length}`, "search_sheet", { query: "" })], "tool_use");
    });
    const run = await runSandboxBot("Help.", ex, ["sheet"], create);
    expect(MAX_TOOL_ROUNDS).toBe(3);
    // per message: 3 tool rounds + 1 forced final answer
    expect(create).toHaveBeenCalledTimes(3 * (MAX_TOOL_ROUNDS + 1));
    const finals = create.mock.calls.filter(([p]) => (p.tool_choice as { type?: string } | undefined)?.type === "none");
    expect(finals).toHaveLength(3);
    expect(run.turns.map((t) => t.reply.text)).toEqual(["Final answer.", "Final answer.", "Final answer."]);
    expect(run.sandbox.sheet!.lookups).toHaveLength(9);
  });

  it("returns every model call for usage recording, and adds each message's usage into its transcript turn", async () => {
    const create = vi.fn<CreateFn>(async (p) =>
      p.messages.length === 1 ? reply([use("t", "search_sheet", {})], "tool_use", { input_tokens: 200, output_tokens: 10 }) : reply([text("ok")], "end_turn", { input_tokens: 300, output_tokens: 30 }),
    );
    const run = await runSandboxBot("Help.", ex, ["sheet"], create);
    expect(run.calls).toHaveLength(6);
    expect(run.calls.every((c) => c.model === "claude-haiku-5-5" && c.costUsd > 0)).toBe(true);
    expect(run.turns[0]!.reply.usage).toMatchObject({ input_tokens: 500, output_tokens: 40 });
    const calls = run.calls.reduce((n, c) => n + c.usage.input_tokens, 0);
    expect(calls).toBe(3 * 500);
  });
});
