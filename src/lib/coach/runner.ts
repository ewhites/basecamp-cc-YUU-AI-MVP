import type Anthropic from "@anthropic-ai/sdk";
import type { CoworkerMessage, Exercise } from "../curriculum/types";
import { ARENA_MODELS, costUsd, RUNNER_MODEL, type UsageLike } from "../models";
import { anthropic, FALLBACK_BETA, toCoachError } from "./client";

/**
 * Runs the student's own work: their prompt (Prompt Studio, Model Arena) or their bot
 * (Agent Builder). These calls produce the "output" the coach then grades.
 */

export interface RunOutput {
  model: string;
  text: string;
  usage: UsageLike;
  costUsd: number;
  latencyMs: number;
  stopReason: string | null;
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function usageOf(u: Anthropic.Beta.BetaUsage): UsageLike {
  return {
    input_tokens: u.input_tokens,
    output_tokens: u.output_tokens,
    cache_read_input_tokens: u.cache_read_input_tokens,
    cache_creation_input_tokens: u.cache_creation_input_tokens,
  };
}

async function call(params: {
  model: string;
  system?: string;
  user: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<RunOutput> {
  const started = Date.now();
  try {
    const res = await anthropic().beta.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      ...(params.system ? { system: params.system } : {}),
      output_config: { effort: params.effort ?? "low" },
      messages: [{ role: "user", content: params.user }],
    });
    const usage = usageOf(res.usage);
    const text =
      res.stop_reason === "refusal" ? "[The model declined to answer this prompt.]" : textOf(res.content) || "[No text output]";
    return {
      model: res.model,
      text,
      usage,
      costUsd: costUsd(res.model, usage),
      latencyMs: Date.now() - started,
      stopReason: res.stop_reason,
    };
  } catch (err) {
    throw toCoachError(err);
  }
}

/** The student's prompt with the exercise material attached, exactly as a coworker would send it. */
export function promptWithMaterial(prompt: string, ex: Exercise): string {
  if (!ex.material) return prompt;
  return `${prompt}\n\n<attached_material name="${ex.material.label}">\n${ex.material.text}\n</attached_material>`;
}

export function runStudentPrompt(prompt: string, ex: Exercise): Promise<RunOutput> {
  return call({ model: RUNNER_MODEL, user: promptWithMaterial(prompt, ex), maxTokens: 2000 });
}

/** Model Arena: the byte-identical prompt on three models, in parallel (M02-S3). */
export async function runArena(prompt: string, ex: Exercise): Promise<RunOutput[]> {
  const user = promptWithMaterial(prompt, ex);
  return Promise.all(ARENA_MODELS.map((m) => call({ model: m.id, user, maxTokens: 2000 })));
}

export interface BotTurn {
  message: CoworkerMessage;
  reply: RunOutput;
}

/** Agent Builder: the student's instructions become the bot's system prompt, tested on each coworker message. */
export async function runBot(instructions: string, ex: Exercise): Promise<BotTurn[]> {
  const system = `${instructions}\n\n<knowledge_sheet>\n${ex.knowledge ?? ""}\n</knowledge_sheet>`;
  const messages = ex.coworkerMessages ?? [];
  const replies = await Promise.all(
    messages.map((m) => call({ model: RUNNER_MODEL, system, user: `Message from ${m.from}:\n${m.text}`, maxTokens: 1000 })),
  );
  return messages.map((message, i) => ({ message, reply: replies[i]! }));
}

export function transcriptText(turns: BotTurn[]): string {
  return turns.map((t) => `[${t.message.id}] ${t.message.from}: ${t.message.text}\nBot: ${t.reply.text}`).join("\n\n");
}

export function arenaOutputsText(outputs: RunOutput[]): string {
  return outputs
    .map((o, i) => {
      const label = ARENA_MODELS[i]?.label ?? o.model;
      return `## ${label} (${o.latencyMs} ms, $${o.costUsd.toFixed(5)})\n${o.text}`;
    })
    .join("\n\n");
}
