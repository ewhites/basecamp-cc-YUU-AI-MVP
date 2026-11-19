import type { Metadata } from "next";
import { Sheet } from "@/design/Sheet";
import { Crumbs, Fold, Panel, Section } from "@/design/Structure";
import { budgetConfig } from "@/lib/coach/budget";
import { ARENA_MODELS, costUsd, GRADER_MODEL, modelLabel } from "@/lib/models";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "How it works · AI Lab" };

const fmt = (n: number) => n.toLocaleString("en-US");
const usd = (n: number) => (n < 0.01 ? "under 1 cent" : `$${n.toFixed(2)}`);

/**
 * "How it works": access and history, the tool sandbox, and token economics (WCR AI SIM design spec, student app).
 * The reference page for the structure pieces: Section, Panel, Fold, Crumbs.
 */
export default async function HowItWorks() {
  const v = await requireRole("student", "instructor", "admin");
  const home = v.role === "instructor" ? "/lab/instructor" : v.role === "admin" ? "/lab/admin" : "/lab";
  const { dailyTokensPerStudent } = budgetConfig();
  // One coached attempt: about 3,000 tokens in and 1,000 out (an estimate).
  const perAttempt = (model: string) => costUsd(model, { input_tokens: 3000, output_tokens: 1000 });

  return (
    <div className="ds-page info">
      <Crumbs items={[{ label: "Home", href: home }, { label: "How it works" }]} />
      <Sheet className="ds-rise" title="How it works" brief="What is saved, what the practice tools can do, and what the AI costs">
        <Section title="Your access and history" id="access">
          <Panel>
            <p>Sign in with your Year Up account. Your attempts, scores and coach notes are saved, so you pick up where you left off.</p>
          </Panel>
          <Fold label="Who can see my work">
            <p>
              Your facilitator sees your scores and progress. Usage reports show totals only, never what you wrote. Access
              ends when you leave the program.
            </p>
            <p className="ds-muted">In this prototype everything is sample data, and coach chats stay in this browser tab.</p>
          </Fold>
        </Section>

        <Section title="The tool sandbox" id="sandbox">
          <Panel>
            <p>
              In Module 3 you give an agent a job and pretend tools: a spreadsheet, an outbox, a notes doc and a memory
              panel. Nothing leaves the Lab.
            </p>
          </Panel>
          <Fold label="Two rules the sandbox teaches">
            <h3>Give only the tools the job needs</h3>
            <p>An agent that cannot send email cannot send the wrong email.</p>
            <h3>A person approves anything that goes out</h3>
            <p>Drafts wait in the outbox until you approve them.</p>
          </Fold>
        </Section>

        <Section title="Tokens and cost" id="tokens">
          <Panel>
            <p>
              AI reads and writes in tokens, about three quarters of a word each. Tokens cost money, so the Lab uses the
              smallest model that does the job well: {modelLabel(GRADER_MODEL)} scores your work.
            </p>
            <p>
              You have <b className="ds-num">{fmt(dailyTokensPerStudent)}</b> tokens a day, about{" "}
              {fmt(Math.floor(dailyTokensPerStudent / 4000))} coached attempts. Past the limit, your work is saved and scored the
              next day.
            </p>
          </Panel>
          <Fold label="Cost of one coached attempt by model">
            <table className="info-table">
              <caption className="ds-sr">Estimated cost of one coached attempt on each model</caption>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">Estimate</th>
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
          </Fold>
        </Section>
      </Sheet>
    </div>
  );
}
