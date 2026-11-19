import type { CheckOutcome, GradeResult } from "../coach/grade";
import type { RubricCheck } from "../curriculum/types";

/**
 * The Agent Builder tool sandbox: four pretend tools that live inside the platform.
 * Nothing here sends an email, signs in to an account or reaches the network. Every result is text
 * kept in the run result. Pure code (no server imports), so the pages, the tests and run.ts share it.
 */

/** The one exercise that runs in the tool sandbox: the live build in Module 3. */
export const SANDBOX_EXERCISE = "ab-newhire-it";

export const TOOL_IDS = ["sheet", "outbox", "notes", "memory"] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export const TOOL_LABELS: Record<ToolId, string> = {
  sheet: "Spreadsheet",
  outbox: "Outbox",
  notes: "Notes doc",
  memory: "Memory",
};

/** One line per tool, shown next to the check box in the live build. */
export const TOOL_BLURBS: Record<ToolId, string> = {
  sheet: "Reads the IT guide, one row for each topic",
  outbox: "Drafts an email. A person approves it before anything is sent",
  notes: "Writes notes that stay in the notes doc",
  memory: "Remembers facts about a person for next time",
};

/** Keeps only known tool ids, once each, in the canonical order. Anything else (a bad payload) is dropped. */
export function cleanTools(value: unknown): ToolId[] {
  const list = Array.isArray(value) ? value : [];
  return TOOL_IDS.filter((id) => list.includes(id));
}

// ---------------------------------------------------------------- the spreadsheet

export interface SheetData {
  name: string;
  columns: string[];
  rows: string[][];
}

/** Topic names for guide lines that have no "Topic: text" shape, in the order they appear. */
const NO_COLON_TOPICS = ["Admin rights", "IT Service Desk"];

/** The knowledge sheet text (one "- Topic: text" line per row) as a two-column sheet. */
export function knowledgeSheet(name: string, knowledge: string): SheetData {
  let fallback = 0;
  const rows = knowledge
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2))
    .map((line) => {
      const m = /^([^:]{1,40}): (.+)$/.exec(line);
      if (m) return [m[1]!, m[2]!];
      return [NO_COLON_TOPICS[fallback++] ?? "Note", line];
    });
  return { name, columns: ["Topic", "What the guide says"], rows };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Rows that match any word of the query. An empty query returns every row. */
export function searchSheet(sheet: SheetData, query: string): string[][] {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1);
  if (!words.length) return sheet.rows;
  return sheet.rows.filter((r) => {
    const hay = norm(r.join(" "));
    return words.some((w) => hay.includes(norm(w)));
  });
}

// ---------------------------------------------------------------- tool calls the model can make

export interface ToolDef {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, { type: "string"; description: string }>; required: string[] };
}

/** The API tool each simulated tool maps to. All four are pretend: see executeTool. */
export const TOOL_DEFS: Record<ToolId, ToolDef> = {
  sheet: {
    name: "search_sheet",
    description: "Look up rows in the spreadsheet. Pass words to search for, or leave the query empty to read every row.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Words to look for in the rows. Empty reads every row." } }, required: [] },
  },
  outbox: {
    name: "draft_email",
    description: "Save a draft email in the outbox. It is not sent. A person must approve a draft before anything leaves the outbox.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Who the email is for." },
        subject: { type: "string", description: "The subject line." },
        body: { type: "string", description: "The email text." },
      },
      required: ["to", "subject", "body"],
    },
  },
  notes: {
    name: "write_note",
    description: "Add one line to the notes doc.",
    input_schema: { type: "object", properties: { text: { type: "string", description: "The note." } }, required: ["text"] },
  },
  memory: {
    name: "save_memory",
    description: "Save one fact in memory, to be used in later chats.",
    input_schema: { type: "object", properties: { fact: { type: "string", description: "The fact to remember." } }, required: ["fact"] },
  },
};

export function toolFor(name: string): ToolId | undefined {
  return TOOL_IDS.find((id) => TOOL_DEFS[id].name === name);
}

export function toolDefs(tools: ToolId[]): ToolDef[] {
  return tools.map((t) => TOOL_DEFS[t]);
}

// ---------------------------------------------------------------- what a run leaves behind

export interface SandboxDraft {
  id: string;
  /** The coworker message the bot was answering. */
  messageId: string;
  to: string;
  subject: string;
  body: string;
}

export interface SandboxResult {
  tools: ToolId[];
  /** Present only when the bot was given the spreadsheet. */
  sheet?: { sheet: SheetData; lookups: { messageId: string; query: string; found: number }[] };
  outbox: SandboxDraft[];
  notes: { messageId: string; text: string }[];
  memory: { messageId: string; text: string }[];
  /** Model calls made, all messages together. */
  calls: number;
}

/** What one message's tool calls did, folded into the result after all three messages ran. */
export type ToolEvent =
  | { kind: "lookup"; query: string; found: number }
  | { kind: "draft"; to: string; subject: string; body: string }
  | { kind: "note"; text: string }
  | { kind: "memory"; text: string };

/** At most this many of each thing per message, and this many characters each, so a bot cannot flood the result. */
export const MAX_PER_MESSAGE = 3;
export const MAX_TEXT = 1200;

const str = (v: unknown, max = MAX_TEXT): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Runs one tool call. Returns the text the model sees, and the event to record (none when the call was refused).
 * Only the tools the student chose can run. `counts` tracks how many of each the message has used.
 */
export function executeTool(
  name: string,
  input: unknown,
  granted: ToolId[],
  sheet: SheetData | null,
  counts: Partial<Record<ToolId, number>> = {},
): { text: string; isError: boolean; event?: ToolEvent } {
  const id = toolFor(name);
  if (!id || !granted.includes(id)) return { text: `You do not have a tool called ${name}.`, isError: true };
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const used = (counts[id] = (counts[id] ?? 0) + 1);
  if (id !== "sheet" && used > MAX_PER_MESSAGE) return { text: "That tool has reached its limit for this message.", isError: true };

  if (id === "sheet") {
    if (!sheet) return { text: "The spreadsheet is empty.", isError: true };
    const query = str(args.query, 200);
    const found = searchSheet(sheet, query);
    const text = found.length
      ? found.map((r) => `${r[0]}: ${r.slice(1).join(" ")}`).join("\n")
      : `No rows matched. The sheet has ${sheet.rows.length} rows. Leave the query empty to read every row.`;
    return { text, isError: false, event: { kind: "lookup", query, found: found.length } };
  }
  if (id === "outbox") {
    const to = str(args.to, 200);
    const subject = str(args.subject, 200);
    const body = str(args.body);
    if (!to || !body) return { text: "A draft needs a recipient and a body.", isError: true };
    return { text: "Saved as a draft. It is waiting for a person to approve it. Nothing was sent.", isError: false, event: { kind: "draft", to, subject, body } };
  }
  if (id === "notes") {
    const text = str(args.text);
    if (!text) return { text: "The note was empty.", isError: true };
    return { text: "Added to the notes doc.", isError: false, event: { kind: "note", text } };
  }
  const text = str(args.fact);
  if (!text) return { text: "There was nothing to remember.", isError: true };
  return { text: "Saved to memory.", isError: false, event: { kind: "memory", text } };
}

/** Folds each message's events, in message order, into the four panels. Draft ids run D1, D2, and so on. */
export function foldEvents(
  tools: ToolId[],
  sheet: SheetData | null,
  perMessage: { messageId: string; events: ToolEvent[] }[],
  calls: number,
): SandboxResult {
  const result: SandboxResult = { tools, outbox: [], notes: [], memory: [], calls };
  if (tools.includes("sheet") && sheet) result.sheet = { sheet, lookups: [] };
  for (const { messageId, events } of perMessage) {
    for (const e of events) {
      if (e.kind === "lookup") result.sheet?.lookups.push({ messageId, query: e.query, found: e.found });
      else if (e.kind === "draft") result.outbox.push({ id: `D${result.outbox.length + 1}`, messageId, to: e.to, subject: e.subject, body: e.body });
      else if (e.kind === "note") result.notes.push({ messageId, text: e.text });
      else result.memory.push({ messageId, text: e.text });
    }
  }
  return result;
}

// ---------------------------------------------------------------- the least-privilege check (decided in code)

/**
 * "Gives the bot only the tools its job needs". The IT helper reads the guide and hands people to the IT desk,
 * so it needs the spreadsheet and the outbox. Notes and memory are not needed.
 *
 * Decided here in code, never by the coach, and never labeled in the eval datasets (only coach checks are).
 * It is not in the exercise's `checks` list on purpose: that list feeds the coach prompt, the eval and
 * finalizeGrade in src/lib/coach/grade.ts, all of which stay exactly as they were. attempts.ts adds this
 * outcome after the coach has graded, with withToolsCheck.
 */
export const TOOLS_CHECK: RubricCheck = {
  key: "least_privilege_tools",
  text: "Gives the bot only the tools its job needs",
  skill: "responsible",
  method: "code",
  evidenceFrom: "attempt",
  guidance: "Checked in code: the spreadsheet and the outbox are chosen, and the notes doc and memory are not.",
  miniLesson:
    "Least privilege (M03-S3). List what the bot must do: read the guide, hand people to the IT desk. Students tick only the tools that job needs, then say what could go wrong with each tool left unticked and why it is not worth the risk.",
};

export function leastPrivilege(tools: ToolId[]): boolean {
  return tools.includes("sheet") && tools.includes("outbox") && !tools.includes("notes") && !tools.includes("memory");
}

export function toolsCheckOutcome(tools: ToolId[]): CheckOutcome {
  const pass = leastPrivilege(tools);
  const reasons: string[] = [];
  if (!tools.includes("sheet")) reasons.push("Without the spreadsheet your bot cannot read the IT guide.");
  if (!tools.includes("outbox")) reasons.push("Without the outbox your bot cannot draft a handoff to the IT desk.");
  const extra = tools.filter((t) => t === "notes" || t === "memory").map((t) => TOOL_LABELS[t]);
  if (extra.length) reasons.push(`${extra.join(" and ")} ${extra.length > 1 ? "are" : "is"} not needed for this job. Fewer tools means fewer ways to go wrong.`);
  return {
    key: TOOLS_CHECK.key,
    text: TOOLS_CHECK.text,
    skill: TOOLS_CHECK.skill,
    method: "code",
    pass,
    coachPass: null,
    evidence: `Tools chosen: ${tools.length ? tools.map((t) => TOOL_LABELS[t]).join(", ") : "none"}`,
    evidenceVerified: true,
    reason: pass ? "You gave the bot the spreadsheet and the outbox, and nothing else." : reasons.join(" "),
    needsReview: false,
  };
}

/** The coach's grade plus the code-decided tools check. The coach's own checks are untouched. */
export function withToolsCheck(grade: GradeResult, tools: ToolId[]): GradeResult {
  const outcome = toolsCheckOutcome(tools);
  return { ...grade, checks: [...grade.checks, outcome], passed: grade.passed + (outcome.pass ? 1 : 0), total: grade.total + 1 };
}
