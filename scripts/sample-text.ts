/**
 * Builds believable sample attempt text for the seeder, assembled from fragments so that every
 * passing check has an evidence quote that really appears in the text (same rule as the live coach).
 */
import type { Exercise, RubricCheck } from "../src/lib/curriculum/types";

type Rand = () => number;
const pick = <T>(xs: readonly T[], r: Rand): T => xs[Math.floor(r() * xs.length)]!;

const PROMPT_FRAGS: Record<string, Record<string, string[]>> = {
  role: { _: ["You are a senior help-desk technician.", "You are an experienced operations coordinator.", "Act as a friendly support lead."] },
  single_task: {
    "ps-ticket-summary": ["Summarize the ticket below", "Write a handoff summary of this ticket"],
    "ps-meeting-recap": ["Turn these call notes into a recap", "Write a recap of the call notes"],
    "ps-refund-reply": ["Draft a reply to the customer", "Write a response to this customer email"],
  },
  audience: {
    "ps-ticket-summary": ["for the next-shift technician", "for the tech taking over"],
    "ps-meeting-recap": ["for my manager who missed the call", "for my manager"],
    "ps-refund-reply": ["for the customer", "to send to the customer"],
  },
  format: { _: ["in 5 bullet points under 80 words.", "in 3 short paragraphs, under 120 words.", "as 4 bullets with a subject line."] },
  done_condition: { _: ["Use only the facts provided and do not guess.", "Do not invent details that are not in the text.", "Do not promise anything outside the policy."] },
  protects_personal_data: { _: ["Leave out phone numbers, emails and IDs.", "Remove any personal contact details."] },
};
const WEAK_ENDINGS = ["Make it good.", "Keep it short please.", "Thanks!", "Make it professional."];

const ARENA_FRAGS: Record<string, string[]> = {
  names_pick: ["I picked Sonnet because it covered every rule a new hire needs", "Haiku wins because it answered the question directly"],
  judges_fit: ["it did the task in the format we asked for", "it covered everything the task asked for"],
  judges_trust: ["I checked it against the source and nothing was made up", "Opus added a detail that is not in the source"],
  considers_cost: ["it is also cheaper and faster at our volume", "the cost per run matters because this runs hundreds of times"],
  trust_tiebreak: ["I would still not pick a cheaper model that got facts wrong"],
  cites_detail: ["it kept the 90-day rule and the VPN requirement", "it marked T5 as Urgent because of the password"],
};

const AGENT_FRAGS: Record<string, string[]> = {
  job: ["You help new hires with week-one questions using only the guide.", "Your job is to answer staff questions from the policy."],
  limits: ["Never share passwords or grant access.", "Never approve anything or answer from outside the guide."],
  stop_rule: ["If the guide does not cover it, say you don't know.", "If you are not sure, stop and say so instead of guessing."],
  handoff: ["Send anything you can't answer to the service desk.", "Hand off exceptions to the named team in the guide."],
};
const BOT_REPLIES: Record<string, { good: string; bad: string }> = {
  handled_normal: { good: "Here's how, from the guide: follow the listed steps.", bad: "I think you can probably just restart and try again." },
  handled_tricky: { good: "I can't share that or approve it. Please use the official request process.", bad: "Sure, here is what you asked for." },
  handled_out_of_scope: { good: "That isn't something I handle. Please contact the right team.", bad: "Let me try to help with that." },
};

export function fragmentsFor(ex: Exercise, outcomes: { check: RubricCheck; pass: boolean }[], r: Rand) {
  const evidence: Record<string, string> = {};
  const passOf = (k: string) => outcomes.find((o) => o.check.key === k)?.pass ?? false;

  if (ex.studio === "prompt") {
    const parts: string[] = [];
    const add = (key: string) => {
      const table = PROMPT_FRAGS[key]!;
      const f = pick(table[ex.id] ?? table._!, r);
      evidence[key] = f.replace(/[.]$/, "");
      parts.push(f);
    };
    if (passOf("role")) add("role");
    const task = pick(PROMPT_FRAGS.single_task![ex.id]!, r);
    let sentence = passOf("single_task") ? task : `${task} and also list every follow-up question and a fix plan`;
    if (passOf("single_task")) evidence.single_task = task;
    if (passOf("audience")) {
      const a = pick(PROMPT_FRAGS.audience![ex.id]!, r);
      sentence += ` ${a}`;
      evidence.audience = a;
    }
    if (passOf("format")) {
      const f = pick(PROMPT_FRAGS.format!._!, r);
      sentence += ` ${f}`;
      evidence.format = f.replace(/[.]$/, "");
    } else sentence += ".";
    parts.push(sentence);
    if (passOf("done_condition")) add("done_condition");
    if (passOf("protects_personal_data")) add("protects_personal_data");
    if (!passOf("format")) parts.push(pick(WEAK_ENDINGS, r));
    const prompt = parts.join(" ");
    evidence.under_200_words = `${prompt.split(/\s+/).length} words`;
    return {
      input: { studio: "prompt", prompt },
      output: { text: "(Sample output. Seeded attempts store a placeholder instead of a real model run.)" },
      evidence,
      tip: tipFor(outcomes),
    };
  }

  if (ex.studio === "arena") {
    const parts: string[] = [];
    for (const key of ["names_pick", "judges_fit", "judges_trust", "considers_cost", "cites_detail"]) {
      if (passOf(key)) {
        const f = pick(ARENA_FRAGS[key]!, r);
        evidence[key] = f;
        parts.push(f);
      }
    }
    if (!passOf("trust_tiebreak")) parts.push("Haiku was a little wrong but it is the cheapest so I picked it");
    if (parts.length === 0) parts.push("They all seemed fine, I liked the first one");
    return {
      input: { studio: "arena", prompt: "Summarize this for a new hire in 5 bullets.", pickedModel: pick(["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"], r), reasoning: parts.join(". ") + "." },
      output: { outputs: [] },
      evidence,
      tip: tipFor(outcomes),
    };
  }

  // agent
  const lines: string[] = [];
  for (const key of ["job", "limits", "stop_rule", "handoff"]) {
    if (passOf(key)) {
      const f = pick(AGENT_FRAGS[key]!, r);
      evidence[key] = f.replace(/[.]$/, "");
      lines.push(f);
    }
  }
  if (lines.length === 0) lines.push("Be helpful and friendly to everyone.");
  const transcript = (ex.coworkerMessages ?? []).map((m) => {
    const key = m.kind === "normal" ? "handled_normal" : m.kind === "tricky" ? "handled_tricky" : "handled_out_of_scope";
    const reply = passOf(key) ? BOT_REPLIES[key]!.good : BOT_REPLIES[key]!.bad;
    if (passOf(key)) evidence[key] = reply;
    return { id: m.id, from: m.from, text: m.text, reply };
  });
  return { input: { studio: "agent", instructions: lines.join(" ") }, output: { transcript }, evidence, tip: tipFor(outcomes) };
}

function tipFor(outcomes: { check: RubricCheck; pass: boolean }[]): string {
  const miss = outcomes.find((o) => !o.pass);
  if (!miss) return "Every check passed. Stretch goal: cut every word that doesn't change the output (M01-S2, pass 4).";
  return `Next, work on this check: "${miss.check.text}" Re-read the lesson section it comes from and add that part.`;
}
