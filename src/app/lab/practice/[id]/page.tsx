import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AttemptResult } from "@/components/AttemptResult";
import { ExerciseBrief, Material } from "@/components/ExercisePicker";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { Progress } from "@/design/Progress";
import { COURSE, MODULE_INFO } from "@/lib/curriculum/course";
import { getExercise } from "@/lib/curriculum/exercises";
import { lessonFor } from "@/lib/curriculum/lessons";
import { myProgress } from "@/lib/progress";
import { SANDBOX_EXERCISE } from "@/lib/sandbox/tools";
import { requireRole } from "@/lib/session";
import { myAttempts } from "@/lib/student-data";
import { readIntro } from "../../intro";
import { AgentForm } from "../AgentForm";
import { ArenaForm } from "../ArenaForm";
import type { TaskHead } from "../Frame";
import { KIND_LABELS } from "../kinds";
import { nextAfterPractice, orderedPractice } from "../order";
import { PromptForm } from "../PromptForm";

/** One practice task a screen: where you are, the task and your work on the sheet, the coach's latest result beside it. */
export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("student");
  const { id } = await params;
  const ex = getExercise(id);
  const group = COURSE.find((g) => g.steps.some((s) => s.kind === "practice" && s.exerciseId === id));
  // The two other agent exercises stay in the data for the eval but left the course map: send old links to the live build.
  if (ex?.studio === "agent" && !group) redirect(`/lab/practice/${SANDBOX_EXERCISE}`);
  if (!ex || !group || ex.studio === "check") notFound();
  const sandbox = ex.id === SANDBOX_EXERCISE;

  const intro = readIntro(await cookies());
  const info = MODULE_INFO[ex.module];
  const practice = orderedPractice(ex.module, intro);
  const index = practice.findIndex((s) => s.exerciseId === id);
  const step = practice[index]!;
  const lessonHref = group.steps.find((s) => s.kind === "lesson")?.href ?? "/lab";
  const next = nextAfterPractice(ex.module, step.id, intro);

  const [history, progress] = await Promise.all([myAttempts(ex.id), myProgress()]);
  const latest = history[0] ?? null;
  const alreadyDone = progress.states[step.id]?.done ?? false;
  const earlier = history.slice(1);
  const lesson = lessonFor(ex.module);
  const doneInModule = group.steps.filter((s) => progress.states[s.id]?.done).length;

  const task = (
    <div className="ln-task">
      <p className="ln-question">{sandbox ? "Write the bot's instructions and pick its tools. We test it on three messages from coworkers. Use the four-part spec: Job, Tools and limits, Stop rule, Handoff" : ex.brief}</p>
      <ExerciseBrief ex={ex} />
      {ex.knowledge && (
        <Material
          label={sandbox ? "The IT guide" : "The bot's knowledge sheet"}
          note={sandbox ? "Your bot can read it only with the Spreadsheet tool" : "The only thing it may answer from"}
          text={ex.knowledge}
          testId="knowledge-sheet"
        />
      )}
      {ex.coworkerMessages && (
        <section className="ln-tests" aria-labelledby="tests-title">
          <h2 id="tests-title" className="ln-label">
            Your bot will be tested on these three messages
          </h2>
          <ol className="ln-convo">
            {ex.coworkerMessages.map((m) => (
              <li key={m.id} data-testid={`coworker-${m.id}`}>
                <div className="ln-say">
                  <span className="ln-label">
                    {m.from}, {KIND_LABELS[m.kind].toLowerCase()} message
                  </span>
                  <p>{m.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      <div className="ln-task-links">
        {ex.studio === "prompt" && (
          <details className="ln-fold" data-testid="strong-prompt-checklist">
            <summary>
              What a strong prompt has
              <Icon name="down" />
            </summary>
            <ul className="ln-hints ln-fold-body">
              {lesson.checklist.map((c) => (
                <li key={c.label}>
                  <b>{c.label}</b>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <Button variant="quiet" href={lessonHref} data-testid="see-worked-example">
          See the worked example
        </Button>
      </div>
    </div>
  );

  const head: TaskHead = {
    kicker: ex.track,
    title: ex.title,
    brief: ex.scenario,
    task,
    module: ex.module,
    earlier:
      earlier.length > 0 ? (
        <details className="ln-fold ln-earlier" data-testid="attempt-history">
          <summary>
            Earlier attempts ({earlier.length})
            <Icon name="down" />
          </summary>
          <div className="ln-fold-body">
            {earlier.map((a) => (
              <AttemptResult key={a.id} exerciseId={ex.id} attempt={a} compact />
            ))}
          </div>
        </details>
      ) : undefined,
  };

  return (
    <div className="ds-page ln-page">
      <Progress className="ln-where ds-rise" label={info.title} value={doneInModule / group.steps.length} end={`Task ${index + 1} of ${practice.length}`} />
      {ex.studio === "prompt" && <PromptForm key={ex.id} exerciseId={ex.id} latest={latest} next={next} alreadyDone={alreadyDone} head={head} />}
      {ex.studio === "arena" && <ArenaForm key={ex.id} exerciseId={ex.id} latest={latest} next={next} alreadyDone={alreadyDone} head={head} />}
      {ex.studio === "agent" && <AgentForm key={ex.id} exerciseId={ex.id} latest={latest} messages={ex.coworkerMessages ?? []} next={next} alreadyDone={alreadyDone} head={head} />}
    </div>
  );
}
