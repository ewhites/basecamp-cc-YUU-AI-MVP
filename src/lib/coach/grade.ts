import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Exercise, RubricCheck, Skill } from "../curriculum/types";
import { costUsd, GRADER_EFFORT, GRADER_MODEL, type UsageLike } from "../models";
import { anthropic, CoachUnavailableError, FALLBACK_BETA, toCoachError } from "./client";
import { coachSystemPrompt, coachUserMessage, COACH_PROMPT_VERSION } from "./prompt";
import { quoteAppearsIn, wordCount } from "./verify";

export const GradeSchema = z.object({
  checks: z.array(
    z.object({
      key: z.string(),
      evidence: z.string(),
      pass: z.boolean(),
      reason: z.string(),
    }),
  ),
  tip: z.string(),
});
export type RawGrade = z.infer<typeof GradeSchema>;

export interface CheckOutcome {
  key: string;
  text: string;
  skill: Skill;
  method: RubricCheck["method"];
  /** Final result after code verification. needsReview checks never count as a pass. */
  pass: boolean;
  /** What the coach said before verification (kept for the eval and the audit trail). */
  coachPass: boolean | null;
  evidence: string;
  evidenceVerified: boolean;
  reason: string;
  needsReview: boolean;
}

export interface GradeResult {
  checks: CheckOutcome[];
  tip: string;
  passed: number;
  total: number;
  needsReview: boolean;
  model: string;
  promptVersion: string;
  usage: UsageLike;
  costUsd: number;
  latencyMs: number;
}

export interface GradeInput {
  exercise: Exercise;
  /** The student's own text (already scrubbed of personal info). */
  attempt: string;
  /** The AI output / model outputs / bot transcript the coach also sees. */
  output: string;
  model?: string;
  effort?: "low" | "medium" | "high";
}

/** Code-decided checks. Never sent to the model to decide. */
function codeCheck(check: RubricCheck, attempt: string): CheckOutcome {
  if (check.key === "under_200_words") {
    const n = wordCount(attempt);
    return {
      key: check.key,
      text: check.text,
      skill: check.skill,
      method: "code",
      pass: n < 200,
      coachPass: null,
      evidence: `${n} words`,
      evidenceVerified: true,
      reason: n < 200 ? `${n} words, under the 200-word limit.` : `${n} words; the limit is 200.`,
      needsReview: false,
    };
  }
  throw new Error(`No code implementation for check ${check.key}`);
}

/**
 * Applies the rubric's code-level rules to the coach's raw answer:
 * - every rubric check must be answered, else it needs instructor review
 * - a pass needs a verified quote from the right source, else it needs review and does not count
 * - unverifiable evidence on a fail is dropped (never shown as a quote)
 */
export function finalizeGrade(ex: Exercise, raw: RawGrade, parts: { attempt: string; output: string }) {
  const byKey = new Map(raw.checks.map((c) => [c.key, c]));
  const checks: CheckOutcome[] = ex.checks.map((check) => {
    if (check.method === "code") return codeCheck(check, parts.attempt);
    const r = byKey.get(check.key);
    if (!r) {
      return {
        key: check.key,
        text: check.text,
        skill: check.skill,
        method: "coach",
        pass: false,
        coachPass: null,
        evidence: "",
        evidenceVerified: false,
        reason: "The coach did not grade this check.",
        needsReview: true,
      };
    }
    const source = check.evidenceFrom === "attempt" ? parts.attempt : parts.output;
    const hasEvidence = r.evidence.trim().length > 0;
    const verified = hasEvidence && quoteAppearsIn(r.evidence, source);
    // trust_tiebreak is the one check that can pass without a quote (nothing to quote when cost wasn't misused).
    const quoteOptional = check.key === "trust_tiebreak";
    let needsReview = false;
    let pass = r.pass;
    if (r.pass && !verified && !(quoteOptional && !hasEvidence)) {
      needsReview = true;
      pass = false;
    }
    return {
      key: check.key,
      text: check.text,
      skill: check.skill,
      method: "coach",
      pass,
      coachPass: r.pass,
      evidence: verified ? r.evidence.trim() : "",
      evidenceVerified: verified,
      reason: needsReview ? `${r.reason} (Quote not found in the student's text, so an instructor should check this.)` : r.reason,
      needsReview,
    };
  });
  const passed = checks.filter((c) => c.pass).length;
  return { checks, tip: raw.tip.trim(), passed, total: checks.length, needsReview: checks.some((c) => c.needsReview) };
}

export async function gradeAttempt(input: GradeInput): Promise<GradeResult> {
  const { exercise, attempt, output } = input;
  const model = input.model ?? GRADER_MODEL;
  const started = Date.now();
  let response;
  try {
    response = await anthropic().beta.messages.parse({
      model,
      max_tokens: 8000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: [{ type: "text", text: coachSystemPrompt(exercise), cache_control: { type: "ephemeral" } }],
      output_config: { effort: input.effort ?? GRADER_EFFORT, format: betaZodOutputFormat(GradeSchema) },
      messages: [{ role: "user", content: coachUserMessage(exercise, { attempt, output }) }],
    });
  } catch (err) {
    throw toCoachError(err);
  }
  const latencyMs = Date.now() - started;

  if (response.stop_reason === "refusal") {
    throw new CoachUnavailableError("The coach declined to grade this attempt; an instructor will review it.", false);
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new CoachUnavailableError("The coach's answer was cut off or unreadable.", true);
  }

  const final = finalizeGrade(exercise, response.parsed_output, { attempt, output });
  const usage: UsageLike = {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_input_tokens: response.usage.cache_read_input_tokens,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens,
  };
  return {
    ...final,
    model: response.model,
    promptVersion: COACH_PROMPT_VERSION,
    usage,
    costUsd: costUsd(response.model, usage),
    latencyMs,
  };
}
