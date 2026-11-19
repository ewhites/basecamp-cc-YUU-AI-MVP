import type { ToolId } from "../sandbox/tools";

/**
 * The five model-facing skills the coach practices (WCR AI SIM design spec, Career Pathways AI Skills curriculum).
 * Changed from the four AI Fluency skills on 2026-11-19 at Logan's request. Every rubric check kept its key,
 * text and guidance, so the human eval labels (keyed by check) still apply.
 */
export const SKILLS = ["prompting", "validation", "context", "models", "responsible"] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_LABELS: Record<Skill, string> = {
  prompting: "Prompting",
  validation: "Validation",
  context: "Context engineering",
  models: "Comparing models",
  responsible: "Responsible use",
};

export const SKILL_BLURBS: Record<Skill, string> = {
  prompting: "Asking for one clear outcome in a clear shape",
  validation: "Checking the output against the source",
  context: "Giving the AI the role, reader and facts it needs",
  models: "Picking the right model for the job and the cost",
  responsible: "Protecting people and data, and owning the result",
};

/** The six competencies of the Career Pathways AI Skills curriculum. Each module maps to one (see MODULE_INFO). */
export const COMPETENCIES = [
  "AI Fundamentals",
  "AI Best Practices",
  "Generative AI",
  "Generative AI Applications",
  "Agentic AI",
  "Context Engineering",
] as const;
export type Competency = (typeof COMPETENCIES)[number];

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
  | { studio: "agent"; instructions: string; tools?: ToolId[] }
  | { studio: "check"; answer: string };
