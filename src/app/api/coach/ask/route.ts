import { NextResponse, type NextRequest } from "next/server";
import { toCoachError } from "@/lib/coach/client";
import { scrubPii } from "@/lib/coach/privacy";
import { askCoach } from "@/lib/coach/qa";

/**
 * Lesson Q&A for the Python module-chatbot eval (eval/run_eval.py via eval/app/chatbot.py), so
 * that eval measures the real "Ask the coach" path instead of a stand-in.
 *
 * Development only: 404 in production, and only with the header `x-lab-eval: 1`. Same steps as the
 * in-app box (src/app/lab/actions.ts): scrub personal info, then askCoach (which runs the distress
 * tripwire before any Claude call).
 */
export const dynamic = "force-dynamic";

const MAX_QUESTION_CHARS = 4000;

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" || req.headers.get("x-lab-eval") !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let question: unknown;
  try {
    question = ((await req.json()) as { question?: unknown }).question;
  } catch {
    return NextResponse.json({ error: 'Send JSON: {"question": "..."}' }, { status: 400 });
  }
  if (typeof question !== "string" || !question.trim()) return NextResponse.json({ error: "question must be a non-empty string" }, { status: 400 });
  if (question.length > MAX_QUESTION_CHARS) return NextResponse.json({ error: `question is over ${MAX_QUESTION_CHARS} characters` }, { status: 413 });

  try {
    const a = await askCoach(scrubPii(question).text);
    return NextResponse.json({
      text: a.text,
      model: a.model,
      usage: a.usage,
      stop_reason: a.stopReason,
      latency_ms: a.latencyMs,
      distress: a.distress,
    });
  } catch (err) {
    const e = toCoachError(err);
    // A missing key will not fix itself on retry; tell the caller not to back off and try again.
    const retryable = Boolean(process.env.ANTHROPIC_API_KEY) && e.retryable;
    return NextResponse.json({ error: e.message, retryable }, { status: 503 });
  }
}
