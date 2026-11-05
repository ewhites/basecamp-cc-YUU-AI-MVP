import { AskCoach } from "@/components/AskCoach";
import { AttemptResult } from "@/components/AttemptResult";
import { ExerciseBrief, ExercisePicker } from "@/components/ExercisePicker";
import { SampleTag } from "@/components/Tags";
import { exercisesFor, getExercise } from "@/lib/curriculum/exercises";
import { requireRole } from "@/lib/session";
import { myAttempts } from "@/lib/student-data";
import { PromptStudioForm } from "./PromptStudioForm";

export default async function PromptStudio({ searchParams }: { searchParams: Promise<{ ex?: string }> }) {
  await requireRole("student");
  const list = exercisesFor("prompt");
  const { ex: exId } = await searchParams;
  const ex = getExercise(exId ?? "") ?? list[0]!;
  const history = await myAttempts(ex.id);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="row">
            <h1 style={{ margin: 0 }}>Prompt Studio</h1>
            <SampleTag />
          </div>
          <p className="muted" style={{ margin: "0.3rem 0 0" }}>
            Write a prompt for a real task. See what the AI does with it, get scored, and improve it.
          </p>
        </div>
      </div>
      <ExercisePicker exercises={list} current={ex.id} basePath="/lab/prompt-studio" />
      <div className="split">
        <div className="stack">
          <section className="card">
            <h2>{ex.title}</h2>
            <ExerciseBrief ex={ex} />
          </section>
          <AskCoach exerciseId={ex.id} module={ex.module} />
        </div>
        <div className="stack">
          <PromptStudioForm key={ex.id} exerciseId={ex.id} latest={history[0] ?? null} />
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
