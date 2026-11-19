import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AttemptResult } from "@/components/AttemptResult";
import { ExerciseBrief, Material } from "@/components/ExercisePicker";
import { Button } from "@/design/Button";
import { Progress } from "@/design/Progress";
import { Crumbs, Fold, Panel, Section } from "@/design/Structure";
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

  const taskText = sandbox ? "Write the bot's instructions and pick its tools. Then we test it on three coworker messages." : ex.brief;
  const task = (
    <>
      <Section title="Your task" id="task">
        <Panel>
          <p className="ln-read">{taskText}</p>
          {sandbox && <p className="ln-hint">Use the four-part spec: Job, Tools and limits, Stop rule, Handoff</p>}
        </Panel>
        <ExerciseBrief ex={ex} />
        {ex.knowledge && (
          <Material
            label={sandbox ? "The IT guide" : "The bot's knowledge sheet"}
            note={sandbox ? "Your bot can read it only with the Spreadsheet tool" : "The only thing it may answer from"}
            text={ex.knowledge}
            testId="knowledge-sheet"
          />
        )}
        {ex.studio === "prompt" && (
          <Fold label="What a strong prompt has" data-testid="strong-prompt-checklist">
            <ul className="ln-hints">
              {lesson.checklist.map((c) => (
                <li key={c.label}>
                  <b>{c.label}</b>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </Fold>
        )}
        <div className="ln-help">
          <Button variant="secondary" arrow href={lessonHref} data-testid="see-worked-example">
            See the worked example
          </Button>
        </div>
      </Section>
    </>
  );

  const tests = ex.coworkerMessages && (
      <Section title="Test messages" id="tests" desc="Your bot will be tested on these three">
        <Panel list>
          <ol className="ds-rows ln-msgs">
            {ex.coworkerMessages.map((m) => (
              <li key={m.id} className="ds-row" data-testid={`coworker-${m.id}`}>
                <p className="ln-msg-who">
                  {m.from}
                  <span>{KIND_LABELS[m.kind]} message</span>
                </p>
                <p className="ln-msg-text">{m.text}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </Section>
  );

  const head: TaskHead = {
    title: ex.title,
    brief: ex.scenario,
    task,
    tests,
    module: ex.module,
    earlier:
      earlier.length > 0 ? (
        <Fold label={`Earlier attempts (${earlier.length})`} className="ln-earlier" data-testid="attempt-history">
          {earlier.map((a) => (
            <AttemptResult key={a.id} exerciseId={ex.id} attempt={a} compact />
          ))}
        </Fold>
      ) : undefined,
  };

  return (
    <div className="ds-page ln-page">
      <Crumbs
        items={[
          { label: "Home", href: "/lab" },
          { label: `Module ${info.number}: ${info.title}`, href: lessonHref },
          { label: ex.title },
        ]}
      />
      <Progress className="ln-where ds-rise" label={info.title} value={doneInModule / group.steps.length} end={`Task ${index + 1} of ${practice.length}`} />
      {ex.studio === "prompt" && <PromptForm key={ex.id} exerciseId={ex.id} latest={latest} next={next} alreadyDone={alreadyDone} head={head} />}
      {ex.studio === "arena" && <ArenaForm key={ex.id} exerciseId={ex.id} latest={latest} next={next} alreadyDone={alreadyDone} head={head} />}
      {ex.studio === "agent" && <AgentForm key={ex.id} exerciseId={ex.id} latest={latest} messages={ex.coworkerMessages ?? []} next={next} alreadyDone={alreadyDone} head={head} />}
    </div>
  );
}
