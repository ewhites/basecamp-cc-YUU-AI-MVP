import { AskCoach } from "@/components/AskCoach";
import { AttemptResult } from "@/components/AttemptResult";
import { ExerciseBrief, ExercisePicker } from "@/components/ExercisePicker";
import { SampleTag } from "@/components/Tags";
import { exercisesFor, getExercise } from "@/lib/curriculum/exercises";
import { requireRole } from "@/lib/session";
import { myAttempts } from "@/lib/student-data";
import { AgentBuilderForm } from "./AgentBuilderForm";
import { KIND_LABELS, KIND_TAG } from "./kinds";

export default async function AgentBuilder({ searchParams }: { searchParams: Promise<{ ex?: string }> }) {
  await requireRole("student");
  const list = exercisesFor("agent");
  const { ex: exId } = await searchParams;
  const found = getExercise(exId ?? "");
  const ex = found?.studio === "agent" ? found : list[0]!;
  const history = await myAttempts(ex.id);
  const messages = ex.coworkerMessages ?? [];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="row">
            <h1 style={{ margin: 0 }}>Agent Builder</h1>
            <SampleTag />
          </div>
          <p className="muted" style={{ margin: "0.3rem 0 0" }}>
            Write a bot&apos;s instructions, test it on three coworker messages, see what breaks and fix it.
          </p>
        </div>
      </div>
      <ExercisePicker exercises={list} current={ex.id} basePath="/lab/agent-builder" />
      <div className="split">
        <div className="stack">
          <section className="card">
            <h2>{ex.title}</h2>
            <ExerciseBrief ex={ex} />
            {ex.knowledge && (
              <details style={{ marginTop: "0.6rem" }}>
                <summary className="small" style={{ cursor: "pointer" }}>
                  <b>The bot&apos;s knowledge sheet</b> (the only thing it may answer from)
                </summary>
                <pre style={{ marginTop: "0.4rem" }} data-testid="knowledge-sheet">
                  {ex.knowledge}
                </pre>
              </details>
            )}
          </section>
          <section className="card">
            <h3 style={{ marginTop: 0 }}>The three test messages</h3>
            <p className="small muted">Your bot will get these exact messages from coworkers.</p>
            <ul className="checks">
              {messages.map((m) => (
                <li key={m.id} className="check" style={{ gridTemplateColumns: "1fr" }} data-testid={`coworker-${m.id}`}>
                  <div>
                    <div className="row" style={{ gap: "0.4rem" }}>
                      <b className="small">{m.from}</b>
                      <span className={`tag ${KIND_TAG[m.kind]}`}>{KIND_LABELS[m.kind]}</span>
                    </div>
                    <div className="small" style={{ marginTop: "0.2rem" }}>
                      “{m.text}”
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <AskCoach exerciseId={ex.id} module={ex.module} />
        </div>
        <div className="stack">
          <AgentBuilderForm key={ex.id} exerciseId={ex.id} latest={history[0] ?? null} messages={messages} />
          {history.length > 1 && (
            <section className="card">
              <h2>Attempt history</h2>
              <div className="stack">
                {history.slice(1).map((a) => (
                  <details key={a.id}>
                    <summary style={{ cursor: "pointer" }}>
                      Attempt {a.attemptNo}: {a.passed ?? "–"}/{a.total ?? "–"} checks · {new Date(a.createdAt).toLocaleString()}
                    </summary>
                    <div style={{ marginTop: "0.5rem" }}>
                      <AttemptResult exerciseId={ex.id} attempt={a} compact />
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
