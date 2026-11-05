import Link from "next/link";
import { notFound } from "next/navigation";
import { AskCoach } from "@/components/AskCoach";
import { AttemptResult } from "@/components/AttemptResult";
import { ExerciseBrief } from "@/components/ExercisePicker";
import { ALL_STEPS, COURSE, MODULE_INFO } from "@/lib/curriculum/course";
import { getExercise } from "@/lib/curriculum/exercises";
import { lessonFor } from "@/lib/curriculum/lessons";
import { myProgress } from "@/lib/progress";
import { requireRole } from "@/lib/session";
import { myAttempts } from "@/lib/student-data";
import { AgentForm } from "../AgentForm";
import { ArenaForm } from "../ArenaForm";
import { KIND_LABELS, KIND_TAG } from "../kinds";
import { PromptForm } from "../PromptForm";

/** One practice task per screen: the task, the form, the latest result, then earlier attempts. */
export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("student");
  const { id } = await params;
  const ex = getExercise(id);
  const group = COURSE.find((g) => g.steps.some((s) => s.kind === "practice" && s.exerciseId === id));
  if (!ex || !group || ex.studio === "check") notFound();

  const info = MODULE_INFO[ex.module];
  const practice = group.steps.filter((s) => s.kind === "practice");
  const index = practice.findIndex((s) => s.exerciseId === id);
  const lessonHref = group.steps.find((s) => s.kind === "lesson")?.href ?? "/lab";
  const at = ALL_STEPS.findIndex((s) => s.id === practice[index]!.id);
  const nextStep = ALL_STEPS[at + 1];
  const next = nextStep ? { title: nextStep.title, href: nextStep.href } : null;

  const [history, progress] = await Promise.all([myAttempts(ex.id), myProgress()]);
  const latest = history[0] ?? null;
  const alreadyDone = progress.states[practice[index]!.id]?.done ?? false;
  const earlier = history.slice(1);
  const lesson = lessonFor(ex.module);

  return (
    <div className="practice stack">
      <header className="stack-sm">
        <div className="eyebrow">
          Module {info.number} · Practice {index + 1} of {practice.length}
        </div>
        <h1 style={{ margin: 0 }}>{ex.title}</h1>
      </header>

      <section className="card stack-sm" aria-label="The task">
        <ExerciseBrief ex={ex} />
        {ex.knowledge && (
          <details className="disclosure">
            <summary>The bot&apos;s knowledge sheet (the only thing it may answer from)</summary>
            <pre data-testid="knowledge-sheet">{ex.knowledge}</pre>
          </details>
        )}
        {ex.coworkerMessages && (
          <div className="stack-sm">
            <div className="eyebrow" style={{ marginTop: 8 }}>Your bot will be tested on these three messages</div>
            <ul className="test-messages">
              {ex.coworkerMessages.map((m) => (
                <li key={m.id} data-testid={`coworker-${m.id}`}>
                  <div className="row" style={{ gap: 6 }}>
                    <b className="small">{m.from}</b>
                    <span className={`tag ${KIND_TAG[m.kind]}`}>{KIND_LABELS[m.kind]}</span>
                  </div>
                  <div className="small">{m.text}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="task-links">
          {ex.studio === "prompt" && (
            <details className="disclosure" data-testid="strong-prompt-checklist">
              <summary>What a strong prompt has</summary>
              <ul className="checklist">
                {lesson.checklist.map((c) => (
                  <li key={c.label}>
                    <b>{c.label}.</b> {c.text}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <Link href={lessonHref} className="small" data-testid="see-worked-example">
            See the worked example
          </Link>
        </div>
      </section>

      {ex.studio === "prompt" && <PromptForm key={ex.id} exerciseId={ex.id} latest={latest} next={next} alreadyDone={alreadyDone} />}
      {ex.studio === "arena" && <ArenaForm key={ex.id} exerciseId={ex.id} latest={latest} next={next} alreadyDone={alreadyDone} />}
      {ex.studio === "agent" && <AgentForm key={ex.id} exerciseId={ex.id} latest={latest} messages={ex.coworkerMessages ?? []} next={next} alreadyDone={alreadyDone} />}

      {earlier.length > 0 && (
        <details className="disclosure card card-tight" data-testid="attempt-history">
          <summary>Earlier attempts ({earlier.length})</summary>
          <div className="history">
            {earlier.map((a) => (
              <details key={a.id} className="disclosure">
                <summary>
                  Attempt {a.attemptNo} · {a.passed ?? "–"}/{a.total ?? "–"} checks · {new Date(a.createdAt).toLocaleString()}
                </summary>
                <div style={{ marginTop: 10 }}>
                  <AttemptResult exerciseId={ex.id} attempt={a} compact />
                </div>
              </details>
            ))}
          </div>
        </details>
      )}

      <AskCoach exerciseId={ex.id} module={ex.module} />
    </div>
  );
}
