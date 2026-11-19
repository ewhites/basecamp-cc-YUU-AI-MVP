import type { Metadata } from "next";
import { Sheet } from "@/design/Sheet";
import { budgetConfig } from "@/lib/coach/budget";
import { ARENA_MODELS, costUsd, GRADER_MODEL, modelLabel } from "@/lib/models";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "How it works · AI Lab" };

const fmt = (n: number) => n.toLocaleString("en-US");
const usd = (n: number) => (n < 0.01 ? `less than 1 cent` : `$${n.toFixed(2)}`);

/**
 * "How it works": persistent access and history, the tool sandbox, and token economics (WCR AI SIM design spec,
 * student app). Plain reading page on the study ground. Numbers come from the same budget and price table the app uses.
 */
export default async function HowItWorks() {
  await requireRole("student", "instructor", "admin");
  const { dailyTokensPerStudent } = budgetConfig();
  // One coached attempt: about 3,000 tokens in and 1,000 out (rough, shown as an estimate).
  const perAttempt = (model: string) => costUsd(model, { input_tokens: 3000, output_tokens: 1000 });

  return (
    <div className="ds-page info">
      <Sheet
        className="ds-rise"
        kicker={<>AI Lab · <span className="ds-note">Sample data</span></>}
        title="How it works"
        brief="Three things worth knowing before you start: what is saved, what the practice tools can do, and what the AI costs."
      >
        <section className="info-sec" aria-labelledby="hw-access">
          <h2 id="hw-access">Your access and history</h2>
          <p>
            You sign in with your Year Up account. Access is for the current cohort only, and it ends when you leave the
            program. Your attempts, scores and coach notes are saved to your record, so you pick up where you left off.
          </p>
          <p className="ds-muted">
            In this prototype everything is sample data and coach chats stay in this browser tab. Your facilitator sees
            your scores and progress. Usage reports show totals only, never what you wrote.
          </p>
        </section>

        <section className="info-sec" aria-labelledby="hw-sandbox">
          <h2 id="hw-sandbox">The tool sandbox</h2>
          <p>
            In Module 3 you give an agent a job and a few practice tools: a spreadsheet, an outbox, a notes doc and a
            memory panel. They are all pretend. Nothing leaves the Lab: no real emails, no sign-ins to other accounts.
          </p>
          <p className="ds-muted">
            Give an agent only the tools its job needs. Anything it wants to send waits in the outbox until you approve it.
          </p>
        </section>

        <section className="info-sec" aria-labelledby="hw-tokens">
          <h2 id="hw-tokens">Tokens and cost</h2>
          <p>
            AI models read and write in tokens, about three quarters of a word each. Every coach reply uses tokens, and
            tokens cost money. Bigger models cost more per token, so the Lab uses the smallest model that does the job
            well: {modelLabel(GRADER_MODEL)} scores your work.
          </p>
          <table className="info-table">
            <caption className="ds-sr">Estimated cost of one coached attempt on each model</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">One coached attempt (estimate)</th>
              </tr>
            </thead>
            <tbody>
              {ARENA_MODELS.map((m) => (
                <tr key={m.id}>
                  <th scope="row">{m.label}</th>
                  <td className="ds-num">{usd(perAttempt(m.id))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ds-muted">
            You have {fmt(dailyTokensPerStudent)} tokens a day, enough for about {fmt(Math.floor(dailyTokensPerStudent / 4000))} coached
            attempts. When you reach it, your work is saved and scored the next day. Your facilitator can raise your limit.
          </p>
        </section>
      </Sheet>
    </div>
  );
}
