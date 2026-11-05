import type { ModuleId } from "./types";

/**
 * The 5-minute lesson that opens each module, built on the sample corpus (eval/corpus/module-0*.md).
 * Order follows learning science: why it matters, an annotated worked example, a faded example
 * (one part missing, the student writes it), then a three-line recap.
 * Every scenario here is different from the practice exercises in exercises.ts, so a lesson never
 * hands a student the answer to a practice task.
 */

export type PartKey = "a" | "b" | "c" | "d";

export interface LessonPart {
  key: PartKey;
  label: string;
  /** Why this part is there. One or two short sentences. */
  note: string;
}

/** A run of example text, highlighted as one part (or plain when `part` is unset). */
export interface Segment {
  text: string;
  part?: PartKey;
}

/** Model Arena lessons: a short summary of what each model returned for the same prompt. */
export interface ComparisonRow {
  model: string;
  summary: string;
  time: string;
  cost: string;
}

export interface WorkedExample {
  /** The situation, one or two sentences. */
  scenario: string;
  head: string;
  /** "lines": each segment on its own line (bot specs). "inline": one paragraph (prompts, reasoning). */
  layout: "inline" | "lines";
  segments: Segment[];
  comparison?: ComparisonRow[];
  /** Agent lessons: how the example bot answers one tricky message. */
  exchange?: { from: string; text: string; reply: string };
  /** One closing observation under the annotations. */
  aside?: string;
}

export interface FadedExample {
  scenario: string;
  head: string;
  layout: "inline" | "lines";
  /** The segments in order; the one whose part equals `missing` is replaced by the student's box. */
  segments: Segment[];
  comparison?: ComparisonRow[];
  missing: PartKey;
  ask: string;
  placeholder: string;
  answer: string;
  /** One line to compare their version with the model answer. */
  checkYours: string;
}

export interface Lesson {
  module: ModuleId;
  /** Corpus sections this lesson teaches. */
  sources: string;
  intro: string;
  parts: LessonPart[];
  worked: WorkedExample;
  faded: FadedExample;
  recap: [string, string, string];
  /** The "What a strong answer has" checklist shown, collapsed, on the practice pages. Not an answer. */
  checklist: { label: string; text: string }[];
}

export const LESSONS: Record<ModuleId, Lesson> = {
  M01: {
    module: "M01",
    sources: "M01-S1, M01-S4, M01-S6",
    intro:
      "A prompt is everything you give the AI before it answers. A vague prompt gets you a draft you have to redo; a specific one gets you something you can use. Every prompt in this course has three parts, in this order: Role, Task, Guardrails.",
    parts: [
      { key: "a", label: "Role", note: "Who the AI is acting as. It sets the tone and what the AI pays attention to." },
      { key: "b", label: "Task", note: "One outcome, for a named reader, with a measurable length or format. “150 words” works better than “short”." },
      { key: "c", label: "Guardrails", note: "What the AI must not do, and what done looks like. This is also where you keep personal details out." },
    ],
    worked: {
      scenario: "You help with the budget at a community center. A board member with no finance background asked how the quarter went.",
      head: "A strong prompt",
      layout: "inline",
      segments: [
        { text: "You are a finance assistant at a community center.", part: "a" },
        { text: " " },
        { text: "Write a 150-word summary of this quarter's budget for a board member who has no finance background.", part: "b" },
        { text: " " },
        {
          text: "Use only the figures in the attached table and don't round them. Leave out staff names and salaries. You're done when the last sentence names the one line item that went over budget.",
          part: "c",
        },
      ],
      aside: "Notice there's no “please” or “could you kindly”. Polite words don't make the output better. Measurable limits do.",
    },
    faded: {
      scenario: "You coordinate front-desk volunteers at a health clinic and want the AI to draft next week's reminder from the schedule.",
      head: "Your prompt",
      layout: "inline",
      segments: [
        { text: "You are a volunteer coordinator at a community health clinic.", part: "a" },
        { text: " " },
        { text: "Write a reminder for next week's front-desk volunteers in 3 bullets, under 60 words: start time, where to park, and who to call if they're running late.", part: "b" },
        { text: " " },
        { text: "", part: "c" },
      ],
      missing: "c",
      ask: "The Guardrails are missing. Write them: what must the AI not do, and what should it leave out?",
      placeholder: "Use only… Don't… Leave out…",
      answer: "Use only the details in the schedule below and don't invent times. Leave out volunteers' phone numbers and home addresses.",
      checkYours: "Does yours say what the AI must not do, and keep personal details out?",
    },
    recap: [
      "Role: say who the AI is acting as.",
      "Task: one outcome, for a named reader, with a measurable length or format.",
      "Guardrails: what the AI must not do, what done looks like, and which personal details to leave out.",
    ],
    checklist: [
      { label: "Role", text: "Says who the AI is acting as." },
      { label: "Task", text: "Asks for one outcome." },
      { label: "Reader", text: "Names who the output is for." },
      { label: "Format", text: "Sets a measurable length or shape, like 4 bullets or under 80 words." },
      { label: "Guardrails", text: "Says what the AI must not do, or what done looks like." },
      { label: "Privacy", text: "Tells the AI to leave out personal details." },
      { label: "Length", text: "Your prompt is under 200 words." },
    ],
  },

  M02: {
    module: "M02",
    sources: "M02-S1, M02-S2, M02-S3",
    intro:
      "Different AI models are good at different jobs, and the most expensive one isn't always the right pick. You'll judge them the way you'd judge any tool at work: does it do the job, can you trust it, and what does it cost. Every model gets the same prompt, word for word, so the only thing that changes is the model.",
    parts: [
      { key: "d", label: "Pick", note: "Say which one, up front." },
      { key: "a", label: "Fit", note: "Did it do the job you asked, in the format you asked?" },
      { key: "b", label: "Trust", note: "Check it against the source and name anything wrong or made up. Trust breaks ties." },
      { key: "c", label: "Cost", note: "Money and time, at the real volume. A lower price never beats a wrong answer." },
    ],
    worked: {
      scenario: "Your warehouse wants AI to turn each day's delivery notes into a 3-line update for drivers, about 250 times a month. You sent the same prompt to three models.",
      head: "A strong pick and why",
      layout: "inline",
      comparison: [
        { model: "Haiku", summary: "3 lines. Says the Elm St drop is at 2pm; the notes say 3pm.", time: "1.1 s", cost: "$0.0001" },
        { model: "Sonnet", summary: "3 lines. Every time and dock matches the notes.", time: "2.8 s", cost: "$0.002" },
        { model: "Opus", summary: "3 lines. Every fact matches, with slightly smoother wording.", time: "5.2 s", cost: "$0.004" },
      ],
      segments: [
        { text: "I pick Sonnet.", part: "d" },
        { text: " " },
        { text: "Fit: all three gave drivers 3 short lines, which is the job.", part: "a" },
        { text: " " },
        { text: "Trust: I checked each line against the notes. Haiku moved the Elm St drop from 3pm to 2pm, so a driver could show up early. Sonnet and Opus matched.", part: "b" },
        { text: " " },
        { text: "Cost: at 250 runs a month, Sonnet costs about half what Opus does for the same accurate update. Haiku is cheapest, but a wrong time costs more than it saves.", part: "c" },
      ],
      aside: "Opus is the most capable model, and it still didn't win. The job only needed three correct lines.",
    },
    faded: {
      scenario: "HR wants AI to answer staff questions about the new badge system in 2 sentences, about 100 questions a month. Here's what the three models returned.",
      head: "Your pick and why",
      layout: "inline",
      comparison: [
        { model: "Haiku", summary: "2 sentences. Matches the badge notes.", time: "0.9 s", cost: "$0.0001" },
        { model: "Sonnet", summary: "2 sentences. Matches the badge notes.", time: "2.5 s", cost: "$0.001" },
        { model: "Opus", summary: "2 sentences. Says badges work at all 6 sites; the notes list 4.", time: "4.8 s", cost: "$0.003" },
      ],
      segments: [
        { text: "I pick Haiku.", part: "d" },
        { text: " " },
        { text: "Fit: all three answered in 2 sentences.", part: "a" },
        { text: " " },
        { text: "", part: "b" },
        { text: " " },
        { text: "Cost: Haiku is the fastest and cheapest, and at 100 questions a month there's no reason to pay more for the same answer.", part: "c" },
      ],
      missing: "b",
      ask: "The Trust part is missing. What did you check, and what did you find?",
      placeholder: "Trust: I checked…",
      answer: "Trust: I checked each answer against the badge notes. Opus said badges work at all 6 sites, but the notes list only 4, so I can't trust it here. Haiku and Sonnet both matched.",
      checkYours: "Does yours name a specific detail you checked against the source?",
    },
    recap: [
      "Send the same prompt, word for word, to every model.",
      "Judge Fit, then Trust, then Cost, and back each one with a specific detail.",
      "Trust breaks ties. A cheaper answer you can't trust doesn't win.",
    ],
    checklist: [
      { label: "Pick", text: "Names the model you picked." },
      { label: "Fit", text: "Says whether each answer did the job asked." },
      { label: "Trust", text: "Says what you checked against the source, and anything wrong or made up." },
      { label: "Cost", text: "Weighs price or speed at the real volume." },
      { label: "Detail", text: "Points to a specific line or fact in the answers." },
    ],
  },

  M03: {
    module: "M03",
    sources: "M03-S2, M03-S4",
    intro:
      "A bot follows its instructions for everyone who messages it, so a gap in those instructions becomes a wrong answer, over and over. Before you build one, write a four-part spec: Job, Tools and limits, Stop rule, Handoff. A good bot that can't finish says so and hands off. It never makes something up to look helpful.",
    parts: [
      { key: "a", label: "Job", note: "One sentence, one outcome, one source to answer from." },
      { key: "b", label: "Tools and limits", note: "What it may do, and what it must never do or promise." },
      { key: "c", label: "Stop rule", note: "When it stops and says it doesn't know, instead of guessing." },
      { key: "d", label: "Handoff", note: "Who it sends people to, and how to reach them. The part people skip most, and the one worth the most." },
    ],
    worked: {
      scenario: "A food bank wants a bot that answers volunteers' questions about signing up for shifts, using its Volunteer Guide.",
      head: "A strong bot spec",
      layout: "lines",
      segments: [
        { text: "Job: You answer volunteers' questions about signing up for food bank shifts, using only the Volunteer Guide below.", part: "a" },
        { text: "Tools and limits: You only answer questions. You never sign anyone up, cancel a shift, or share another volunteer's contact details.", part: "b" },
        { text: "Stop rule: If the guide doesn't answer the question, say “I don't know” instead of guessing. Keep each answer under 60 words.", part: "c" },
        { text: "Handoff: For anything you can't answer, send them to the volunteer coordinator at volunteer@foodbank.example or ext. 210.", part: "d" },
      ],
      exchange: {
        from: "Volunteer",
        text: "Can you just put me on Saturday's 9am shift?",
        reply: "I can't sign you up myself. The volunteer coordinator can: email volunteer@foodbank.example or call ext. 210.",
      },
    },
    faded: {
      scenario: "Your office wants a bot that answers staff questions about the parking garage, using the Parking Rules.",
      head: "Your bot spec",
      layout: "lines",
      segments: [
        { text: "Job: You answer staff questions about the parking garage, using only the Parking Rules below.", part: "a" },
        { text: "Tools and limits: You never issue permits, waive fines, or promise anyone a space.", part: "b" },
        { text: "Stop rule: If the rules don't cover it, say you don't know instead of guessing.", part: "c" },
        { text: "", part: "d" },
      ],
      missing: "d",
      ask: "The Handoff is missing. Who should the bot send people to, and how do they reach them?",
      placeholder: "Handoff: For…, send them to…",
      answer: "Handoff: For permits, fines or anything the rules don't cover, send them to the Facilities desk at ext. 3300 or parking@office.example.",
      checkYours: "Does yours name a person or team, and how to reach them?",
    },
    recap: [
      "Job: one sentence, one outcome, one source.",
      "Limits and stop rule: what the bot never does, and when it says “I don't know”.",
      "Handoff: who it sends people to when it can't finish.",
    ],
    checklist: [
      { label: "Job", text: "One sentence: what the bot does, for whom, from which source." },
      { label: "Tools and limits", text: "What it must never do or promise." },
      { label: "Stop rule", text: "When it says “I don't know” instead of guessing." },
      { label: "Handoff", text: "Who it sends people to, and how to reach them." },
    ],
  },
};

export function lessonFor(module: ModuleId): Lesson {
  return LESSONS[module];
}
