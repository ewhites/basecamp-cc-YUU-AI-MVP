import Link from "next/link";
import type { Exercise } from "@/lib/curriculum/types";

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

export function ExerciseBrief({ ex }: { ex: Exercise }) {
  return (
    <div className="stack">
      <div className="row">
        <span className="tag tag-info">{ex.module}</span>
        <span className="tag tag-info">{ex.track}</span>
      </div>
      <p>
        <b>Scenario.</b> {ex.scenario}
      </p>
      <p>
        <b>Your task.</b> {ex.brief}
      </p>
      {ex.material && (
        <details>
          <summary className="small" style={{ cursor: "pointer" }}>
            <b>{ex.material.label}</b> (attached to your prompt)
          </summary>
          <pre style={{ marginTop: "0.4rem" }}>{ex.material.text}</pre>
        </details>
      )}
    </div>
  );
}
