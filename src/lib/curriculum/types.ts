export const SKILLS = ["delegation", "description", "discernment", "diligence"] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_LABELS: Record<Skill, string> = {
  delegation: "Delegation",
  description: "Description",
  discernment: "Discernment",
  diligence: "Diligence",
};

export const SKILL_BLURBS: Record<Skill, string> = {
  delegation: "Deciding what to hand to AI",
  description: "Saying clearly what you need",
  discernment: "Judging whether the output is any good",
  diligence: "Taking responsibility for how AI is used",
};

/** "check" = a short task in the starting point or final skills check (not a practice module). */
export type Studio = "prompt" | "arena" | "agent" | "check";

export const STUDIO_LABELS: Record<Studio, string> = {
  prompt: "Prompt Studio",
  arena: "Model Arena",
  agent: "Agent Builder",
  check: "Skills check",
};

export type ModuleId = "M01" | "M02" | "M03";

/**
 * One yes/no rubric check.
 * - method "coach": the Claude coach decides, quoting evidence.
 * - method "code": decided in code (e.g. word count), never by the model.
 * - evidenceFrom: which text the coach must quote. "attempt" = the student's own words,
 *   "output" = the AI output / bot transcript the student produced.
 */
export interface RubricCheck {
  key: string;
  text: string;
  skill: Skill;
  method: "coach" | "code";
  evidenceFrom: "attempt" | "output";
  /** What "yes" means, written for the coach. */
  guidance: string;
  /** Pre-written 10-minute mini-lesson for instructors when many students miss this. */
  miniLesson: string;
}

export interface CoworkerMessage {
  id: string;
  kind: "normal" | "tricky" | "out_of_scope";
  from: string;
  text: string;
}

export interface Exercise {
  id: string;
  studio: Studio;
  module: ModuleId;
  title: string;
  track: string;
  /** Workplace scenario, shown to the student. */
  scenario: string;
  /** What the student must produce. */
  brief: string;
  /** Sample work material attached to the student's prompt (sample data). */
  material?: { label: string; text: string };
  checks: RubricCheck[];
  /** One example of a strong attempt, used inside the coach prompt. */
  goodExample: { attempt: string; note: string };
  /** Agent Builder only. */
  coworkerMessages?: CoworkerMessage[];
  /** Agent Builder only: the knowledge sheet the bot may answer from. */
  knowledge?: string;
  /** Skills check only: the starting point check or the matching final check. */
  checkKind?: "start" | "final";
}

/** What the student submits, per studio. */
export type AttemptInput =
  | { studio: "prompt"; prompt: string }
  | { studio: "arena"; prompt: string; pickedModel: string; reasoning: string }
  | { studio: "agent"; instructions: string }
  | { studio: "check"; answer: string };
