import Link from "next/link";
import type { Exercise } from "@/lib/curriculum/types";

/** Tabs between exercises in one studio. Kept for older screens; the course player links steps instead. */
export function ExercisePicker({ exercises, current, basePath }: { exercises: Exercise[]; current: string; basePath: string }) {
  return (
    <div className="row" role="tablist" aria-label="Exercises">
      {exercises.map((e, i) => (
        <Link key={e.id} href={`${basePath}?ex=${e.id}`} className={`btn ${e.id === current ? "btn-primary" : ""}`} role="tab" aria-selected={e.id === current}>
          {i + 1}. {e.title}
        </Link>
      ))}
    </div>
  );
}

/** Long material starts collapsed so the task stays on one screen. */
const LONG_MATERIAL = 420;

/** The task: scenario, what to produce, and the attached sample material. */
export function ExerciseBrief({ ex }: { ex: Exercise }) {
  const long = (ex.material?.text.length ?? 0) > LONG_MATERIAL;
  return (
    <div className="brief stack-sm">
      <p style={{ margin: 0 }}>{ex.scenario}</p>
      <p style={{ marginBottom: 0 }}>
        <b>Your task:</b> {ex.brief}
      </p>
      {ex.material && (
        <details className="disclosure" open={!long} data-testid="material">
          <summary>
            {ex.material.label} <span className="muted" style={{ fontWeight: 400 }}>· attached to your prompt</span>
          </summary>
          <pre>{ex.material.text}</pre>
        </details>
      )}
    </div>
  );
}
