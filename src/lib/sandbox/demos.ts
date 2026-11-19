import type { SheetData, ToolId } from "./tools";

/**
 * The two scripted agent demos in Module 3. No model calls: every line, tool call and result is written here,
 * so the demos cost nothing and work when Claude is down. All names, vendors and addresses are made up.
 *
 * A demo is a list of steps. A step is one beat the student reveals with Continue:
 * the agent's short reasoning line, and optionally one tool call with its input and result.
 * A tool call updates its panel: the spreadsheet is read, a line lands in the notes doc or in memory,
 * or a draft lands in the outbox. The one step with a `draft` is the approval gate: the student must
 * choose Approve or Send back. Send back makes the agent revise once, and then the student approves it.
 */

export interface DemoCall {
  tool: ToolId;
  /** The tool's name, as the agent calls it. */
  name: string;
  /** What the agent passed in, as labeled lines. */
  input: Record<string, string>;
  /** What the tool answered. */
  result: string;
}

export interface DemoDraft {
  to: string;
  subject: string;
  body: string;
  /** What the agent does when the student sends the draft back. */
  revised: { reasoning: string; body: string };
}

export interface DemoStep {
  id: string;
  /** The agent's reasoning, one short line. */
  reasoning: string;
  call?: DemoCall;
  /** Set on the approval step only. */
  draft?: DemoDraft;
}

export interface Demo {
  /** The course step id, stored in lesson_progress when the student reaches the end. */
  id: string;
  slug: string;
  title: string;
  minutes: number;
  /** The situation, one or two sentences. */
  scenario: string;
  /** What the person asks the agent for. */
  request: { from: string; text: string };
  /** The tools this agent has. The others show as not given. */
  tools: ToolId[];
  sheet: SheetData;
  steps: DemoStep[];
  /** What the agent says when the draft is approved. */
  sent: string;
  /** The three teaching points, shown at the end. */
  teach: { title: string; text: string }[];
}

export const DEMOS: Demo[] = [
  {
    id: "demo-research",
    slug: "research",
    title: "Research assistant",
    minutes: 4,
    scenario:
      "A food bank needs a caterer for its June volunteer lunch. Dana asks a research assistant to compare four vendors and draft a summary for her director.",
    request: { from: "Dana, volunteer coordinator", text: "Compare these caterers for our June lunch. Safety first, and keep it short." },
    tools: ["sheet", "outbox", "notes", "memory"],
    sheet: {
      name: "Vendor shortlist",
      columns: ["Vendor", "Price per meal", "Delivery", "Allergen labels"],
      rows: [
        ["Greenfork Catering", "$9.50", "Same day", "Every dish"],
        ["Harbor Kitchen", "$8.75", "Next day", "Some dishes"],
        ["Maple & Main", "$11.20", "Same day", "Every dish"],
        ["Northside Eats", "$7.90", "2 days", "None"],
      ],
    },
    steps: [
      {
        id: "read",
        reasoning: "I need the facts first. I will read the vendor sheet.",
        call: { tool: "sheet", name: "search_sheet", input: { query: "all vendors" }, result: "Read 4 rows: Greenfork, Harbor Kitchen, Maple & Main, Northside Eats." },
      },
      {
        id: "safety",
        reasoning: "Dana said safety first. Only two vendors label every dish, so I will write that down.",
        call: {
          tool: "notes",
          name: "write_note",
          input: { text: "Allergen labels on every dish: Greenfork, Maple & Main. Northside has none, so it is out." },
          result: "Added to the notes doc.",
        },
      },
      {
        id: "remember",
        reasoning: "This is a rule Dana will want again, so I will remember it.",
        call: {
          tool: "memory",
          name: "save_memory",
          input: { fact: "Dana ranks allergen safety first and likes short summaries." },
          result: "Saved to memory.",
        },
      },
      {
        id: "price",
        reasoning: "Price breaks the tie. Greenfork costs $1.70 less per meal than Maple & Main, and both deliver the same day.",
        call: {
          tool: "notes",
          name: "write_note",
          input: { text: "Pick: Greenfork, $9.50 a meal, same day. Backup: Maple & Main, $11.20." },
          result: "Added to the notes doc.",
        },
      },
      {
        id: "draft",
        reasoning: "The summary goes to Dana's director. I can draft it, but a person must approve it before it is sent.",
        call: {
          tool: "outbox",
          name: "draft_email",
          input: { to: "director@foodbank.example", subject: "Caterer for the June volunteer lunch" },
          result: "Saved as a draft. It is waiting for a person to approve it. Nothing was sent.",
        },
        draft: {
          to: "director@foodbank.example",
          subject: "Caterer for the June volunteer lunch",
          body: "I compared four caterers on allergen labels, price and delivery. Greenfork Catering labels every dish, costs $9.50 a meal and delivers the same day. Maple & Main also labels every dish, at $11.20, and is the backup. Northside Eats has no allergen labels, so I left it out.",
          revised: {
            reasoning: "You sent it back, so I will cut it to what the director needs: the pick, the price and the reason.",
            body: "Recommended caterer: Greenfork Catering, $9.50 a meal, same-day delivery. It labels every dish for allergens. Backup: Maple & Main at $11.20.",
          },
        },
      },
    ],
    sent: "Sent (simulated). No real email left the platform.",
    teach: [
      { title: "Context, reasoning, tools", text: "The agent read the sheet for context, reasoned from Dana's rule, then used tools to write, remember and draft." },
      { title: "Least privilege", text: "It could read, write notes and draft. It could not send. Each tool is there because the job needs it." },
      { title: "A person approves", text: "The email waited. Anything that leaves the building needs a person to approve it first." },
    ],
  },
  {
    id: "demo-travel",
    slug: "travel",
    title: "Travel planner",
    minutes: 4,
    scenario: "Sam is going to a conference in Denver. A travel planner has the travel policy sheet and an outbox. It has no booking tool, on purpose.",
    request: { from: "Sam, program manager", text: "Book me a flight to Denver on June 12 and a hotel for two nights." },
    tools: ["sheet", "outbox"],
    sheet: {
      name: "Travel policy",
      columns: ["Topic", "Rule"],
      rows: [
        ["Flights", "Economy only. Book at least 14 days ahead."],
        ["Hotels", "Up to $180 a night."],
        ["Meals", "Up to $60 a day."],
        ["Approval", "Trips over $800 need a manager's approval."],
        ["Booking", "The travel desk books trips. Staff send a trip request."],
      ],
    },
    steps: [
      {
        id: "read",
        reasoning: "I will check the travel policy before I plan anything.",
        call: { tool: "sheet", name: "search_sheet", input: { query: "flights hotels booking" }, result: "Read 5 rows of the travel policy." },
      },
      {
        id: "cannot",
        reasoning: "You asked me to book it. I cannot, because I have no booking tool. I only have the policy sheet and the outbox.",
      },
      {
        id: "plan",
        reasoning: "I can do the useful part. An economy flight and two hotel nights at up to $180 come to about $780, under the $800 approval line.",
      },
      {
        id: "draft",
        reasoning: "The policy says the travel desk books trips, so I will draft a trip request for a person to approve.",
        call: {
          tool: "outbox",
          name: "draft_email",
          input: { to: "traveldesk@company.example", subject: "Trip request: Denver, June 12 to 14" },
          result: "Saved as a draft. It is waiting for a person to approve it. Nothing was sent.",
        },
        draft: {
          to: "traveldesk@company.example",
          subject: "Trip request: Denver, June 12 to 14",
          body: "Sam is requesting a trip to Denver for a conference. Flight on June 12, economy, and a hotel for two nights. The estimate is about $780, under the $800 approval line. Please book it.",
          revised: {
            reasoning: "You sent it back. The policy asks for booking 14 days ahead, so I will say that the request meets it.",
            body: "Trip request for Sam: Denver, June 12 to 14. Economy flight and two hotel nights at up to $180. Estimate about $780, under the $800 approval line. This request is more than 14 days ahead, as the policy asks. Please book it.",
          },
        },
      },
    ],
    sent: "Sent (simulated). The travel desk would book the trip. The planner never could.",
    teach: [
      { title: "Context, reasoning, tools", text: "The agent read the policy, reasoned about what it was allowed to do, then used its one writing tool." },
      { title: "Least privilege", text: "It said it could not book, because it has no booking tool. Leaving a tool out is how you set that limit." },
      { title: "A person approves", text: "The request waited for a person. The travel desk, not the agent, spends the money." },
    ],
  },
];

export function demoBySlug(slug: string): Demo | undefined {
  return DEMOS.find((d) => d.slug === slug);
}

/** Where the demo's panels stand after the first `shown` steps. Pure, so the page and the tests agree. */
export interface DemoPanels {
  sheetRead: boolean;
  notes: string[];
  memory: string[];
  /** The outbox draft once the agent has saved it. */
  draft: { to: string; subject: string; body: string } | null;
}

/** sentBack: the student sent the draft back once, so the outbox holds the agent's revised version. */
export function panelsAt(demo: Demo, shown: number, sentBack: boolean): DemoPanels {
  const panels: DemoPanels = { sheetRead: false, notes: [], memory: [], draft: null };
  for (const step of demo.steps.slice(0, shown)) {
    const c = step.call;
    if (!c) continue;
    if (c.tool === "sheet") panels.sheetRead = true;
    else if (c.tool === "notes") panels.notes.push(c.input.text ?? "");
    else if (c.tool === "memory") panels.memory.push(c.input.fact ?? "");
    else if (c.tool === "outbox" && step.draft) {
      panels.draft = { to: step.draft.to, subject: step.draft.subject, body: sentBack ? step.draft.revised.body : step.draft.body };
    }
  }
  return panels;
}
