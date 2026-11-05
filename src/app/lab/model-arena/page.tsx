import { AskCoach } from "@/components/AskCoach";
import { AttemptResult } from "@/components/AttemptResult";
import { ExerciseBrief, ExercisePicker } from "@/components/ExercisePicker";
import { SampleTag } from "@/components/Tags";
import { exercisesFor, getExercise } from "@/lib/curriculum/exercises";
import { modelLabel } from "@/lib/models";
import { requireRole } from "@/lib/session";
import { myAttempts } from "@/lib/student-data";
import { ModelArenaForm } from "./ModelArenaForm";

function pickedOf(input: unknown): string | null {
  return typeof input === "object" && input && "pickedModel" in input ? String((input as { pickedModel: string }).pickedModel) : null;
}

export default async function ModelArena({ searchParams }: { searchParams: Promise<{ ex?: string }> }) {
  await requireRole("student");
  const list = exercisesFor("arena");
  const { ex: exId } = await searchParams;
  const found = getExercise(exId ?? "");
  const ex = found?.studio === "arena" ? found : list[0]!;
  const history = await myAttempts(ex.id);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="row">
            <h1 style={{ margin: 0 }}>Model Arena</h1>
            <SampleTag />
          </div>
          <p className="muted" style={{ margin: "0.3rem 0 0" }}>
            Run one prompt on three Claude models side by side, pick the best, and explain why with Fit, Trust and Cost.
          </p>
        </div>
      </div>
      <ExercisePicker exercises={list} current={ex.id} basePath="/lab/model-arena" />
      <div className="split">
        <div className="stack">
          <section className="card">
            <h2>{ex.title}</h2>
            <ExerciseBrief ex={ex} />
          </section>
          <section className="card card-muted">
            <h3 style={{ marginTop: 0 }}>How to judge (M02)</h3>
            <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem" }}>
              <li>
                <b>Fit:</b> did it do the job, in the format you asked for?
              </li>
              <li>
                <b>Trust:</b> anything wrong, invented or risky? Name it.
              </li>
              <li>
                <b>Cost:</b> is the better answer worth the price at this volume?
              </li>
            </ul>
          </section>
          <AskCoach exerciseId={ex.id} module={ex.module} />
        </div>
        <div className="stack">
          <ModelArenaForm key={ex.id} exerciseId={ex.id} latest={history[0] ?? null} />
          {history.length > 1 && (
            <section className="card">
              <h2>Attempt history</h2>
              <div className="stack">
                {history.slice(1).map((a) => {
                  const picked = pickedOf((a as { input?: unknown }).input);
                  return (
                    <details key={a.id}>
                      <summary style={{ cursor: "pointer" }}>
                        Attempt {a.attemptNo}: {a.passed ?? "–"}/{a.total ?? "–"} checks{picked ? ` · picked ${modelLabel(picked)}` : ""} · {new Date(a.createdAt).toLocaleString()}
                      </summary>
                      <div style={{ marginTop: "0.5rem" }}>
                        <AttemptResult exerciseId={ex.id} attempt={a} compact />
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
