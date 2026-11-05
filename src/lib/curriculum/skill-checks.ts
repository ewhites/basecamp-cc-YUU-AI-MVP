import type { Exercise, RubricCheck, Skill } from "./types";

/**
 * The starting point check (before Module 1) and the final check (after Module 3).
 * Four short tasks each, one per fluency skill. The final check is a parallel form:
 * same checks, new scenarios, so the lift from start to finish is measured fairly
 * without teaching to the test. Graded by the same coach pipeline; the starting point
 * is never graded for credit.
 */

const c = (key: string, skill: Skill, text: string, guidance: string, miniLesson: string): RubricCheck => ({
  key,
  skill,
  text,
  guidance,
  miniLesson,
  method: "coach",
  evidenceFrom: "attempt",
});

const describeChecks = (facts: string): RubricCheck[] => [
  c("d_task_audience", "description", "Says what to write and who it's for",
    "The prompt names the thing to produce (a message, email, reminder) and the reader (the team, new hires).",
    "Have students rewrite a vague prompt by adding one line: what it is and who reads it."),
  c("d_format", "description", "Sets a format, length or tone",
    "The prompt asks for a measurable shape: a length, a number of bullets or sentences, or a named tone. 'Make it good' does not count.",
    "Show two outputs from the same task, with and without a length limit, and compare."),
  c("d_key_facts", "description", "Gives the AI the facts it needs",
    `The prompt includes the key facts the AI could not guess: ${facts}. At least one must be stated.`,
    "Context is not memory (M01-S3): list the facts the AI can't know before writing the prompt."),
];

const judgeChecks = (errors: string): RubricCheck[] => [
  c("j_spots_error", "discernment", "Points to a detail that doesn't match the source",
    `The answer names a specific wrong detail in the AI draft: ${errors}. Either one counts. A general 'it might be wrong' does not.`,
    "Pair up: one student plants a wrong detail in an AI summary, the other finds it using only the source."),
  c("j_decision", "discernment", "Makes a clear call on whether to send it",
    "The answer clearly says send it, fix it first, or don't send it.",
    "Practice a one-line verdict: 'Fix before sending, because...'"),
  c("j_source", "discernment", "Says how they'd confirm it",
    "The answer says to check the draft against the source policy or text (not against memory or the AI itself).",
    "Trust is the tiebreaker (M02-S2): show how to check a claim against the source line by line."),
];

const delegateChecks = (handOff: string, keep: string): RubricCheck[] => [
  c("g_hands_off", "delegation", "Hands AI a task that suits it",
    `The answer picks ${handOff} as the task to give the AI.`,
    "Sort ten workplace tasks into 'AI drafts it' and 'a person decides' as a class."),
  c("g_keeps", "delegation", "Keeps a task for a person",
    `The answer keeps ${keep} for a person.`,
    "Walk through the three stop conditions (M01-S6) on the tasks students kept."),
  c("g_reason", "delegation", "Gives a reason based on the stop conditions",
    "The reason says one of: you can't check the answer, it involves someone's personal data, or a wrong answer can't be undone. A reason like 'AI is bad at that' does not count.",
    "Have students name which stop condition (M01-S6) applies to each task they kept."),
];

const protectChecks = (details: string): RubricCheck[] => [
  c("p_removes", "diligence", "Removes personal details before pasting",
    "The answer says to remove, replace or hide personal details before giving the text to the AI.",
    "Live demo: scrub a real-looking (sample) email together, replacing details with [placeholders]."),
  c("p_names_detail", "diligence", "Names a specific detail to remove",
    `The answer names at least one specific detail to remove: ${details}.`,
    "List every personal detail in a sample message; compare lists to find what people missed."),
  c("p_reviews", "diligence", "Checks the AI's work before it goes out",
    "The answer says they'll read, check or edit the AI's draft before it is sent or shared.",
    "Discuss who is responsible when an AI draft goes out with a mistake: the sender."),
];

const base = { studio: "check" as const, track: "All tracks", goodExample: { attempt: "", note: "" } };

export const SKILL_CHECKS: Exercise[] = [
  // ---------------- Starting point ----------------
  {
    ...base,
    id: "sp-describe",
    checkKind: "start",
    module: "M01",
    title: "Write a prompt",
    scenario:
      "Your team lead asks you to use AI to draft a reminder for the team: the shared drive moves to a new system this Friday at 6pm, and anything saved after 5pm Friday may be lost.",
    brief: "Write the prompt you would send to the AI.",
    checks: describeChecks("the Friday 6pm move, or saving files before 5pm"),
  },
  {
    ...base,
    id: "sp-judge",
    checkKind: "start",
    module: "M02",
    title: "Judge an AI draft",
    scenario: "Your manager asked AI to summarize a policy for tomorrow's team newsletter.",
    brief: "Would you send this summary as it is? What would you check or change?",
    material: {
      label: "The policy and the AI's summary (sample)",
      text: `POLICY: Laptops are replaced every 4 years. Employees may request an early replacement if repair costs would exceed $300. Requests go to IT through the service portal.

AI SUMMARY: Laptops are replaced every 3 years. If a repair would cost more than $300, you can ask for a new laptop early by emailing your manager.`,
    },
    checks: judgeChecks("it says 3 years (the policy says 4), or it says to email your manager (the policy says the IT service portal)"),
  },
  {
    ...base,
    id: "sp-delegate",
    checkKind: "start",
    module: "M01",
    title: "Decide what to hand off",
    scenario: "Three tasks are on your list today.",
    brief: "Which one would you hand to AI, and which would you keep for yourself? Say why.",
    material: {
      label: "Today's tasks (sample)",
      text: `A. Draft three subject lines for the monthly team newsletter.
B. Decide whether a coworker's late timesheet should be approved.
C. Summarize a customer's complaint email that includes their account number and home address.`,
    },
    checks: delegateChecks("task A (the newsletter subject lines)", "task B (the timesheet decision) or task C (the email with personal data)"),
  },
  {
    ...base,
    id: "sp-protect",
    checkKind: "start",
    module: "M01",
    title: "Use AI responsibly",
    scenario: "Your manager says: \"Paste this complaint into the AI and have it draft a reply.\"",
    brief: "What do you do before you paste it, and before the reply goes out?",
    material: {
      label: "Customer email (sample)",
      text: `From: Renee Ortiz
My internet has been down for 3 days. My account number is 4471-2290-18 and you can reach me at (412) 555-0187. I work from home and I've already called twice. Please fix this today.`,
    },
    checks: protectChecks("the name, the account number or the phone number"),
  },
  // ---------------- Final check (parallel form) ----------------
  {
    ...base,
    id: "fc-describe",
    checkKind: "final",
    module: "M01",
    title: "Write a prompt",
    scenario:
      "HR asks you to use AI to draft a message to this month's new hires: badge photos are taken Tuesday from 9 to 11am in Room 204, and they need to bring a photo ID.",
    brief: "Write the prompt you would send to the AI.",
    checks: describeChecks("Tuesday 9 to 11am, Room 204, or bringing a photo ID"),
  },
  {
    ...base,
    id: "fc-judge",
    checkKind: "final",
    module: "M02",
    title: "Judge an AI draft",
    scenario: "The front desk asked AI to summarize the visitor policy for a sign by the door.",
    brief: "Would you post this summary as it is? What would you check or change?",
    material: {
      label: "The policy and the AI's summary (sample)",
      text: `POLICY: Visitors must sign in at the front desk and wear a visitor badge at all times. Visitors may not enter the server room without an escort from IT.

AI SUMMARY: Visitors sign in at the front desk. Badges are optional after the first day. Visitors may enter the server room once they sign the visitor log.`,
    },
    checks: judgeChecks("it says badges are optional after the first day (the policy says at all times), or it says visitors can enter the server room by signing the log (the policy says only with an IT escort)"),
  },
  {
    ...base,
    id: "fc-delegate",
    checkKind: "final",
    module: "M01",
    title: "Decide what to hand off",
    scenario: "Three tasks are on your list today.",
    brief: "Which one would you hand to AI, and which would you keep for yourself? Say why.",
    material: {
      label: "Today's tasks (sample)",
      text: `A. Turn your meeting notes into a bulleted to-do list.
B. Decide which job applicant gets an interview.
C. Draft a reply to a coworker's message that mentions the dates of their medical leave.`,
    },
    checks: delegateChecks("task A (the to-do list)", "task B (the interview decision) or task C (the message with medical details)"),
  },
  {
    ...base,
    id: "fc-protect",
    checkKind: "final",
    module: "M01",
    title: "Use AI responsibly",
    scenario: "Your team lead says: \"Have the AI summarize this vendor email for the finance team.\"",
    brief: "What do you do before you give it to the AI, and before the summary is shared?",
    material: {
      label: "Vendor email (sample)",
      text: `From: Marcus Bell, Apex Office Supply
Invoice 2291 was paid twice. Please refund $1,240 to our bank account 0091-4471-332 (routing 021000021). My cell is (617) 555-0122 if finance has questions.`,
    },
    checks: protectChecks("the bank account or routing number, the cell number, or the contact's name"),
  },
];

export function skillCheck(kind: "start" | "final"): Exercise[] {
  return SKILL_CHECKS.filter((e) => e.checkKind === kind);
}
