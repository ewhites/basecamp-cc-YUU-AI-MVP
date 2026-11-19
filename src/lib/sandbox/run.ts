import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, FALLBACK_BETA, toCoachError } from "../coach/client";
import { textOf, usageOf, type BotTurn, type RunOutput } from "../coach/runner";
import type { Exercise } from "../curriculum/types";
import { costUsd, RUNNER_MODEL } from "../models";
import { executeTool, foldEvents, knowledgeSheet, toolDefs, type SandboxResult, type SheetData, type ToolEvent, type ToolId } from "./tools";

/**
 * Agent Builder with tools: the student's instructions become the bot's system prompt, and the bot may use
 * the simulated tools the student chose (src/lib/sandbox/tools.ts). Each coworker message gets a small
 * tool-use loop. No sampling parameters (they return an error on current models).
 *
 * Differences from runBot in src/lib/coach/runner.ts, on purpose:
 * - the knowledge sheet is NOT in the system prompt. The bot sees the guide only if it has the spreadsheet tool.
 * - tools are offered, and at most MAX_TOOL_ROUNDS rounds of tool calls run per message.
 * The bot's final reply text is what the coach grades, in the same transcript format as before.
 */

export const MAX_TOOL_ROUNDS = 3;
/** Reply cap for each model call. The first call and every tool round get the same cap. */
export const SANDBOX_MAX_TOKENS = 800;

export type CreateFn = (params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming) => Promise<Anthropic.Beta.BetaMessage>;

const realCreate: CreateFn = (params) => anthropic().beta.messages.create(params);

export interface SandboxRun {
  turns: BotTurn[];
  /** Every model call made, one entry each, so the caller can record usage for each. */
  calls: RunOutput[];
  sandbox: SandboxResult;
}

function toRun(res: Anthropic.Beta.BetaMessage, started: number): RunOutput {
  const usage = usageOf(res.usage);
  const text = res.stop_reason === "refusal" ? "[The model declined to answer this prompt.]" : textOf(res.content) || "[No text output]";
  return { model: res.model, text, usage, costUsd: costUsd(res.model, usage), latencyMs: Date.now() - started, stopReason: res.stop_reason };
}

async function runMessage(
  instructions: string,
  user: string,
  tools: ToolId[],
  sheet: SheetData | null,
  create: CreateFn,
): Promise<{ calls: RunOutput[]; events: ToolEvent[]; reply: RunOutput }> {
  const defs = toolDefs(tools);
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: user }];
  const calls: RunOutput[] = [];
  const events: ToolEvent[] = [];
  const counts: Partial<Record<ToolId, number>> = {};
  let last: RunOutput | null = null;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // After the last allowed round the model must answer in words, not ask for another tool.
    const finalRound = round === MAX_TOOL_ROUNDS;
    const started = Date.now();
    const res = await create({
      model: RUNNER_MODEL,
      max_tokens: SANDBOX_MAX_TOKENS,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: instructions,
      output_config: { effort: "low" },
      // A copy: the loop keeps adding to `messages`, and each request should show what was sent at that moment.
      messages: [...messages],
      ...(defs.length ? { tools: defs, ...(finalRound ? { tool_choice: { type: "none" as const } } : {}) } : {}),
    });
    last = toRun(res, started);
    calls.push(last);
    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !uses.length || finalRound) break;

    messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
    messages.push({
      role: "user",
      content: uses.map((u) => {
        const out = executeTool(u.name, u.input, tools, sheet, counts);
        if (out.event) events.push(out.event);
        return { type: "tool_result" as const, tool_use_id: u.id, content: out.text, ...(out.isError ? { is_error: true } : {}) };
      }),
    });
  }

  // The reply text is the last call's text. Usage across the message's calls is added up for the transcript turn.
  const total = calls.reduce(
    (a, c) => ({
      input_tokens: a.input_tokens + c.usage.input_tokens,
      output_tokens: a.output_tokens + c.usage.output_tokens,
      cache_read_input_tokens: (a.cache_read_input_tokens ?? 0) + (c.usage.cache_read_input_tokens ?? 0),
      cache_creation_input_tokens: (a.cache_creation_input_tokens ?? 0) + (c.usage.cache_creation_input_tokens ?? 0),
    }),
    { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  );
  const reply: RunOutput = {
    ...last!,
    usage: total,
    costUsd: calls.reduce((n, c) => n + c.costUsd, 0),
    latencyMs: calls.reduce((n, c) => n + c.latencyMs, 0),
  };
  return { calls, events, reply };
}

/** Tests the bot on each coworker message with only the chosen tools. `create` is a seam for tests. */
export async function runSandboxBot(instructions: string, ex: Exercise, tools: ToolId[], create: CreateFn = realCreate): Promise<SandboxRun> {
  const sheet = tools.includes("sheet") && ex.knowledge ? knowledgeSheet(`${ex.title}: guide`, ex.knowledge) : null;
  const messages = ex.coworkerMessages ?? [];
  let results;
  try {
    results = await Promise.all(messages.map((m) => runMessage(instructions, `Message from ${m.from}:\n${m.text}`, tools, sheet, create)));
  } catch (err) {
    throw toCoachError(err);
  }
  const calls = results.flatMap((r) => r.calls);
  return {
    turns: messages.map((message, i) => ({ message, reply: results[i]!.reply })),
    calls,
    sandbox: foldEvents(
      tools,
      sheet,
      messages.map((m, i) => ({ messageId: m.id, events: results[i]!.events })),
      calls.length,
    ),
  };
}
