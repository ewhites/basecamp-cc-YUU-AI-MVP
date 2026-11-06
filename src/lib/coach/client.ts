import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** One shared client. Resolves credentials from ANTHROPIC_API_KEY (never logged). */
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 60_000 });
  return client;
}

/** Server-side refusal fallback: routes a policy decline to the server-chosen default model. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;

export class CoachUnavailableError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "CoachUnavailableError";
  }
}

/** Maps SDK errors to "save and score later" (retryable) vs a real bug (not retryable). */
export function toCoachError(err: unknown): CoachUnavailableError {
  if (err instanceof CoachUnavailableError) return err;
  if (err instanceof Anthropic.RateLimitError) return new CoachUnavailableError("Claude is rate limited.", true);
  if (err instanceof Anthropic.APIConnectionError) return new CoachUnavailableError("Could not reach Claude.", true);
  if (err instanceof Anthropic.AuthenticationError)
    return new CoachUnavailableError("The Anthropic API key is missing or invalid.", true);
  if (err instanceof Anthropic.APIError) {
    const retryable = err.status === undefined || err.status >= 500 || err.status === 408 || err.status === 409;
    return new CoachUnavailableError(`Claude API error ${err.status ?? ""}: ${err.message}`, retryable);
  }
  if (err instanceof Error && /api key|apiKey|ANTHROPIC_API_KEY/i.test(err.message)) {
    return new CoachUnavailableError("The Anthropic API key is not set.", true);
  }
  return new CoachUnavailableError(err instanceof Error ? err.message : String(err), false);
}
