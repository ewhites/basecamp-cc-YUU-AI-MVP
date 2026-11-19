import Link from "next/link";
import { Fold } from "@/design/Structure";
import type { Exercise } from "@/lib/curriculum/types";

/** Links between exercises in one studio. Kept for older screens; the course player links steps instead. */
export function ExercisePicker({ exercises, current, basePath }: { exercises: Exercise[]; current: string; basePath: string }) {
  return (
    <nav className="ln-picker" aria-label="Exercises">
      {exercises.map((e, i) => (
        <Link key={e.id} href={`${basePath}?ex=${e.id}`} className="ds-quiet" aria-current={e.id === current ? "page" : undefined}>
          {i + 1}. {e.title}
        </Link>
      ))}
    </nav>
  );
}

/** Long material starts folded so the task stays on one screen. */
const LONG_MATERIAL = 420;

/**
 * Attached material as a fold: its name, a short note, and a blue chevron. The text sits inside.
 * note: a short line under the name ("Attached to your prompt").
 */
export function Material({
  label,
  text,
  note,
  open,
  testId,
}: {
  label: string;
  text: string;
  note?: string;
  open?: boolean;
  testId?: string;
}) {
  return (
    <Fold label={label} hint={note} open={open} data-testid={testId}>
      <div className="ln-material-text" tabIndex={0} role="region" aria-label={label}>
        {text}
      </div>
    </Fold>
  );
}

/** The task's attached sample material (the scenario and the task itself sit in the sheet's head). */
export function ExerciseBrief({ ex }: { ex: Exercise }) {
  if (!ex.material) return null;
  const long = ex.material.text.length > LONG_MATERIAL;
  return <Material label={ex.material.label} text={ex.material.text} note="Attached to your prompt" open={!long} testId="material" />;
}
