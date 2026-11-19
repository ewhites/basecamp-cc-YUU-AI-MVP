import Link from "next/link";
import { redirect } from "next/navigation";
import { SampleTag } from "@/components/Tags";
import { Button } from "@/design/Button";
import { Icon } from "@/design/icons";
import { Sheet } from "@/design/Sheet";
import { ALL_STEPS, MODULE_INFO } from "@/lib/curriculum/course";
import { SKILL_LABELS, SKILLS, type Skill } from "@/lib/curriculum/types";
import {
  attemptsFor,
  coachReliability,
  exerciseTitle,
  LIFT_GOAL,
  liftOf,
  mySections,
  needsYouToday,
  plainCurriculum,
  sectionOverview,
  unreleasedCount,
  type AttemptListRow,
  type CoachReliability,
  type Lift,
  type MiniLesson,
  type NeedsYouRow,
  type SectionOverview,
} from "@/lib/instructor-data";
import { computeProgress, type Progress } from "@/lib/progress-core";
import { requireRole } from "@/lib/session";
import { AssignMiniLesson, ReleaseScores } from "./ConsoleButtons";
import { percent, sectionHref, shortDate, signedPercent, studentHref } from "./links";

type Params = { section?: string; student?: string; attempt?: string };

/** Needs you today shows every row up to MAX_ROWS, else the first SHOWN and a "Show more". */
const SHOWN = 6;
const MAX_ROWS = 8;

/** The steps a facilitator can see finished: the two checks and the practice tasks (lesson reading is the student's own). */
const TRACKED = ALL_STEPS.filter((s) => s.kind === "check" || s.kind === "practice");

export default async function FacilitatorConsole({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole("instructor");
  const params = await searchParams;
  // Old links put the student on this page. The student view now has its own address.
  if (params.student) redirect(`/lab/instructor/student/${encodeURIComponent(params.student)}${params.attempt ? `?attempt=${encodeURIComponent(params.attempt)}` : ""}`);

  const sections = await mySections();
  const sectionId = params.section ?? (sections.some((s) => s.id === "B") ? "B" : sections[0]?.id);
  const section = sections.find((s) => s.id === sectionId);

  const tabs = sections.length > 1 && (
    <nav className="st-tabs" aria-label="Your sections" data-testid="section-tabs" data-kmk={'aria-current="page"'} data-kmk-bounce="1.6" data-kmk-key="sections" suppressHydrationWarning>
      <span className="kmk" aria-hidden suppressHydrationWarning />
      {sections.map((s) => (
        <Link key={s.id} href={sectionHref(s.id)} aria-current={s.id === sectionId ? "page" : undefined} data-testid={`section-tab-${s.id}`}>
          {s.name}
        </Link>
      ))}
    </nav>
  );

  if (!section) {
    return (
      <div className="ds-page st-page">
        <Sheet className="ds-rise">
          <header className="st-head">
            <div>
              <p className="ds-kicker">Facilitator console</p>
              <h1 className="ds-sheet-title">Your sections</h1>
              <SampleTag />
            </div>
            {tabs}
          </header>
          <p className="st-said st-said-block" data-ok="no" data-testid="no-access">
            <Icon name="minus" />
            <span>{sections.length ? "You don't teach that section, so there is nothing to show." : "You have no sections yet."}</span>
          </p>
        </Sheet>
      </div>
    );
  }

  const overview = await sectionOverview(section.id);
  const ids = overview.students.map((s) => s.id);
  const [needs, ready, reliability, attempts] = await Promise.all([needsYouToday(overview), unreleasedCount(ids), coachReliability(), attemptsFor(ids)]);
  const names = new Map(overview.students.map((s) => [s.id, s.display_name]));
  const progress = cohortProgress(ids, attempts);

  return (
    <div className="ds-page st-page">
      <Sheet>
        <header className="st-head ds-rise" style={{ "--i": 0 } as React.CSSProperties}>
          <div>
            <p className="ds-kicker">Facilitator console{section.cycle ? ` · ${section.cycle}` : ""}</p>
            <h1 className="ds-sheet-title">{section.name}</h1>
            <p className="st-meta">
              <span>{overview.students.length} students</span>
              <SampleTag />
            </p>
          </div>
          {tabs}
        </header>

        <NeedsYou rows={needs} names={names} lessonSkill={overview.miniLesson?.skill ?? null} />

        <div className="st-pair ds-rise" style={{ "--i": 2 } as React.CSSProperties}>
          {overview.miniLesson ? (
            <MostMissed lesson={overview.miniLesson} primary={needs.length === 0} />
          ) : (
            <section className="st-sec" data-testid="mini-lesson" id="mini-lesson">
              <h2>Teach next</h2>
              <p className="st-text">Not enough practice yet to pick a check to teach.</p>
            </section>
          )}
          <LiftPanel lift={overview.lift} students={overview.students.length} />
        </div>

        <section className="st-sec ds-rise" style={{ "--i": 3 } as React.CSSProperties} data-testid="gradebook" id="release">
          <h2>Release scores</h2>
          <p className="st-text">
            {ready === 0
              ? "Every scored attempt is released. Students see a score only after you release it."
              : `${ready} scored ${ready === 1 ? "attempt is" : "attempts are"} waiting. Students see a score only after you release it. Scores that need your review stay back until you check them.`}
          </p>
          <ReleaseScores sectionId={section.id} disabled={ready === 0} />
        </section>

        <section className="st-sec ds-rise" style={{ "--i": 4 } as React.CSSProperties} id="students" aria-labelledby="students-h">
          <h2 id="students-h">Cohort progress</h2>
          <ByLesson progress={progress} total={ids.length} />
          <Heatmap overview={overview} progress={progress} />
        </section>

        <Reliability data={reliability} />
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------- cohort progress (read-only, from attempts)

function cohortProgress(ids: string[], attempts: AttemptListRow[]): Map<string, Progress> {
  const by = new Map<string, AttemptListRow[]>(ids.map((id) => [id, []]));
  for (const a of attempts) by.get(a.student_id)?.push(a);
  // Lesson reading is not part of the facilitator's data, so only checks and practice count here.
  return new Map(ids.map((id) => [id, computeProgress(by.get(id) ?? [], new Set())]));
}

function ByLesson({ progress, total }: { progress: Map<string, Progress>; total: number }) {
  const all = [...progress.values()];
  return (
    <div className="st-sub">
      <h3 className="st-h3">By lesson</h3>
      <p className="st-fine">Finished means the check is answered, or one practice try passed 80% of its checks</p>
      <ol className="ds-rows st-lessons">
        {TRACKED.map((s) => {
          const done = all.filter((p) => p.states[s.id]?.done).length;
          const started = all.filter((p) => p.states[s.id]?.started && !p.states[s.id]?.done).length;
          const where = s.module ? `Module ${MODULE_INFO[s.module].number}` : s.checkKind === "start" ? "Start" : "Finish";
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <li key={s.id} className="ds-row st-lesson">
              <span className="st-lesson-name">
                <b>{s.title}</b>
                <span>{where}</span>
              </span>
              <span className="ds-track st-lesson-bar" role="img" aria-label={`${done} of ${total} finished`}>
                <i style={{ width: `${pct}%` }} />
              </span>
              <span className="st-lesson-n ds-num">
                <b>
                  {done} of {total}
                </b>{" "}
                finished
                {started > 0 && <span className="st-lesson-sub">{started} started</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- needs you today

const ROW_ACTION: Record<NeedsYouRow["kind"], string> = {
  support: "See what happened",
  class: "See mini-lesson",
  stuck: "See where they're stuck",
  review: "Review the score",
  safety: "See details",
};

const ROW_ICON: Record<NeedsYouRow["kind"], "flag" | "class" | "minus" | "clock"> = {
  support: "flag",
  class: "class",
  stuck: "minus",
  review: "clock",
  safety: "flag",
};

function NeedsYou({ rows, names, lessonSkill }: { rows: NeedsYouRow[]; names: Map<string, string>; lessonSkill: Skill | null }) {
  const nameOf = (id: string) => names.get(id) ?? id;
  const action = (href: string, label: string, i: number) =>
    i === 0 ? (
      <Button href={href} className="st-need-btn">
        {label}
      </Button>
    ) : (
      <Button href={href} variant="quiet" className="st-need-link">
        {label}
      </Button>
    );
  const row = (r: NeedsYouRow, i: number) => {
    if (r.kind === "class") {
      const list = r.students ?? [];
      const shown = list.slice(0, 3).map(nameOf).join(", ");
      const toLesson = r.skill === lessonSkill;
      return (
        <li key={`class-${r.skill}`} className="st-need" data-testid="needs-you-row" data-kind={r.kind}>
          <div className="st-need-who">
            <b>Whole section</b>
            <span>{list.length} students</span>
          </div>
          <div className="st-need-what">
            <p className="st-need-head">
              <Icon name={ROW_ICON[r.kind]} />
              <b>{r.headline}</b>
            </p>
            <p>{r.detail}</p>
            <p className="st-fine">
              {shown}
              {list.length > 3 && ` and ${list.length - 3} more`}
            </p>
          </div>
          {action(toLesson ? "#mini-lesson" : "#heatmap", toLesson ? "See mini-lesson" : "See students", i)}
        </li>
      );
    }
    return (
      <li key={r.student_id} className="st-need" data-testid="needs-you-row" data-kind={r.kind}>
        <div className="st-need-who">
          <Link href={studentHref(r.student_id)}>{nameOf(r.student_id)}</Link>
          <span>{r.student_id}</span>
        </div>
        <div className="st-need-what">
          <p className="st-need-head">
            <Icon name={ROW_ICON[r.kind]} />
            <b>{r.headline}</b>
            {r.exercise_id && <span>in {exerciseTitle(r.exercise_id)}</span>}
          </p>
          <p>{r.detail}</p>
          {r.also.length > 0 && <p className="st-fine">Also: {r.also.join(", ")}</p>}
        </div>
        {action(`${studentHref(r.student_id, r.attempt_id)}#why`, ROW_ACTION[r.kind], i)}
      </li>
    );
  };
  const people = new Set(rows.flatMap((r) => (r.students?.length ? r.students : [r.student_id])).filter(Boolean)).size;

  return (
    <section className="st-sec st-sec-first ds-rise" style={{ "--i": 1 } as React.CSSProperties} data-testid="needs-you" id="needs" aria-labelledby="needs-h">
      <div className="st-sec-head">
        <h2 id="needs-h">Needs you today</h2>
        {rows.length > 0 && (
          <span className="st-count ds-num">
            {people} {people === 1 ? "student" : "students"}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="st-text">Nothing needs you today. No one is stuck, no safety flags are open and no scores are waiting for review.</p>
      ) : (
        <>
          <ol className="st-needs">{rows.slice(0, rows.length <= MAX_ROWS ? rows.length : SHOWN).map(row)}</ol>
          {rows.length > MAX_ROWS && (
            <details className="st-more">
              <summary>
                <Icon name="down" />
                Show {rows.length - SHOWN} more
              </summary>
              <ol className="st-needs">{rows.slice(SHOWN).map((r, i) => row(r, i + SHOWN))}</ol>
            </details>
          )}
          <p className="st-fine st-foot">Stuck means under 40% on a skill across their last 3 practice attempts that test it</p>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- most-missed check

function MostMissed({ lesson, primary }: { lesson: MiniLesson; primary: boolean }) {
  const { students, check, section, skill } = lesson;
  const who =
    students > 0
      ? `${students} ${students === 1 ? "student" : "students"} stuck on ${SKILL_LABELS[skill]} ${students === 1 ? "passes" : "pass"} it ${percent(check.rate)} of the time (${check.n} tries).`
      : `Passed ${percent(check.rate)} of the time across the section (${check.n} tries).`;
  return (
    <section className="st-sec" data-testid="mini-lesson" id="mini-lesson" aria-labelledby="teach-h">
      <h2 id="teach-h">Teach next</h2>
      <p className="st-lead">{check.text.replace(/\?$/, "")}</p>
      <p className="st-text">
        {who}
        {students > 0 && ` Whole section: ${percent(section.rate)} of ${section.n} tries.`}
      </p>
      <div className="st-inset">
        <p className="st-inset-label">10-minute mini-lesson</p>
        <p>{plainCurriculum(check.miniLesson)}</p>
      </div>
      <AssignMiniLesson title={check.text.replace(/\?$/, "")} primary={primary} />
    </section>
  );
}

// ---------------------------------------------------------------- starting point to now

function LiftPanel({ lift, students }: { lift: Lift; students: number }) {
  const any = lift.tookBoth > 0;
  const met = lift.lift !== null && lift.lift >= LIFT_GOAL;
  return (
    <section className="st-sec" data-testid="lift-panel" id="lift" aria-labelledby="lift-h">
      <h2 id="lift-h">Starting point to final check</h2>
      {any ? (
        <p className="st-stat">
          <span className="st-stat-n ds-num" data-testid="lift-value">
            {signedPercent(lift.lift)}
          </span>
          <span>average lift</span>
        </p>
      ) : (
        <p className="st-text">No one has taken the final check yet.</p>
      )}
      <p className="st-goal">
        <Icon name={met ? "check" : "minus"} />
        {met ? "Goal met: " : "Goal: "}
        {signedPercent(LIFT_GOAL)}
      </p>

      <ul className="ds-rows st-lift">
        {lift.bySkill.map((r) => {
          const l = liftOf(r.start, r.final);
          const goal = r.start === null ? null : Math.min(1, r.start * (1 + LIFT_GOAL));
          return (
            <li key={r.skill} className="st-lift-row" data-testid={`lift-${r.skill}`}>
              <div className="st-lift-head">
                <b>{SKILL_LABELS[r.skill]}</b>
                <span className="ds-num">
                  {percent(r.start)} to {percent(r.final)}
                </span>
                <span className="ds-num st-lift-delta">{any ? signedPercent(l) : ""}</span>
              </div>
              <div className="st-bars">
                <span className="ds-track ds-track-start" role="img" aria-label={`Starting point ${percent(r.start)}`}>
                  <i style={{ width: `${Math.round((r.start ?? 0) * 100)}%` }} />
                </span>
                <span className="ds-track" role="img" aria-label={`Final check ${percent(r.final)}`}>
                  <i style={{ width: `${Math.round((r.final ?? 0) * 100)}%` }} />
                </span>
                {goal !== null && any && <i className="st-goal-mark" style={{ left: `${Math.round(goal * 100)}%` }} aria-hidden />}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="ds-skill-key st-key" aria-hidden>
        <span>
          <i className="ds-key-start" />
          Starting point
        </span>
        <span>
          <i className="ds-key-final" />
          Final check
        </span>
        {any && (
          <span>
            <i className="st-key-goal" />
            Goal
          </span>
        )}
      </p>
      <p className="st-fine">
        {any
          ? `Average of the ${lift.tookBoth} students who took both. ${lift.tookStart} of ${students} took the starting point; ${lift.tookFinal} took the final check. Lift is how much higher the final score is than the starting score.`
          : `${lift.tookStart} of ${students} students took the starting point. The comparison appears once students take the final check.`}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- students by skill and progress

/** Pass-rate bands, named in words in the key. The number is always printed, so the band never relies on shade alone. */
function band(x: number | null): "na" | "low" | "mid" | "high" {
  if (x === null) return "na";
  if (x < 0.4) return "low";
  if (x < 0.7) return "mid";
  return "high";
}

function Heatmap({ overview, progress }: { overview: SectionOverview; progress: Map<string, Progress> }) {
  return (
    <details className="st-sub st-heat" data-testid="heatmap" id="heatmap">
      <summary>
        <Icon name="down" />
        <span className="st-h3">By student</span>
        <span className="st-fine">Practice pass rate on the last 3 attempts for each skill, and steps finished</span>
      </summary>
      <div className="st-scroll" tabIndex={0} role="region" aria-label="Students by skill">
        <table className="st-table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              {SKILLS.map((s) => (
                <th key={s} scope="col" className="st-c">
                  {SKILL_LABELS[s]}
                </th>
              ))}
              <th scope="col" className="st-c">
                Steps finished
              </th>
            </tr>
          </thead>
          <tbody>
            {overview.students.map((st) => {
              const lv = overview.levels.get(st.id);
              const p = progress.get(st.id);
              const done = p ? TRACKED.filter((s) => p.states[s.id]?.done).length : 0;
              return (
                <tr key={st.id} data-testid={`heat-row-${st.id}`}>
                  <th scope="row">
                    <Link href={studentHref(st.id)}>{st.display_name}</Link>
                    <span>{st.id}</span>
                  </th>
                  {SKILLS.map((s) => {
                    const c = lv?.[s].current ?? null;
                    return (
                      <td key={s} className="st-c">
                        <span className="st-cell ds-num" data-band={band(c)} title={`${SKILL_LABELS[s]}: ${c === null ? "no practice yet" : percent(c)}`}>
                          {band(c) === "low" && <Icon name="minus" />}
                          {percent(c)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="st-c ds-num">
                    {done} of {TRACKED.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="st-key-heat">
        <span className="st-cell" data-band="low">
          <Icon name="minus" />
          Under 40%
        </span>
        <span className="st-cell" data-band="mid">
          40 to 69%
        </span>
        <span className="st-cell" data-band="high">
          70% or more
        </span>
        <span className="st-cell" data-band="na">
          – No practice yet
        </span>
      </p>
    </details>
  );
}

// ---------------------------------------------------------------- coach reliability

function Reliability({ data }: { data: CoachReliability }) {
  const { grading, safety } = data;
  return (
    <section className="st-sec ds-rise" style={{ "--i": 5 } as React.CSSProperties} data-testid="coach-reliability" id="coach" aria-labelledby="coach-h">
      <h2 id="coach-h">Coach reliability</h2>
      {!grading && !safety ? (
        <p className="st-text">Not measured yet.</p>
      ) : (
        <>
          <dl className="ds-rows st-kv">
            {grading && (
              <div className="ds-row">
                <dt>Agrees with human graders</dt>
                <dd>
                  <b className="ds-num">{percent(grading.agreement)}</b>
                  <span>
                    <Icon name={grading.passed ? "check" : "minus"} />
                    {grading.passed ? "Above" : "Below"} the {percent(grading.gate)} bar
                  </span>
                </dd>
              </div>
            )}
            {safety && (
              <div className="ds-row">
                <dt>Safety cases handled correctly</dt>
                <dd>
                  <b className="ds-num">
                    {safety.passed} of {safety.total}
                  </b>
                  <span>
                    <Icon name={safety.ok ? "check" : "minus"} />
                    {safety.ok ? "All passed" : "Not all passed"}
                  </span>
                </dd>
              </div>
            )}
          </dl>
          <p className="st-fine">
            {grading
              ? `Measured ${shortDate(grading.at)} on ${grading.heldOutChecks ? `${grading.heldOutChecks} held-out checks` : "held-out checks"} that were not used to tune the coach. You can still change any score.`
              : `Measured ${shortDate(safety!.at)}.`}
          </p>
        </>
      )}
    </section>
  );
}
