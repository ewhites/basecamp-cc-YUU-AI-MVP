import Link from "next/link";
import { redirect } from "next/navigation";
import { SampleTag } from "@/components/Tags";
import { SKILL_LABELS, SKILLS, type Skill } from "@/lib/curriculum/types";
import {
  coachReliability,
  exerciseTitle,
  heatClass,
  LIFT_GOAL,
  liftOf,
  mySections,
  needsYouToday,
  plainCurriculum,
  sectionOverview,
  unreleasedCount,
  type CoachReliability,
  type Lift,
  type MiniLesson,
  type NeedsYouRow,
  type SectionOverview,
} from "@/lib/instructor-data";
import { requireRole } from "@/lib/session";
import { AssignMiniLesson, SendToGradebook } from "./ConsoleButtons";
import { percent, sectionHref, shortDate, signedPercent, studentHref } from "./links";

type Params = { section?: string; student?: string; attempt?: string };

/** Needs you today shows every row up to MAX_ROWS, else the first SHOWN and a "Show more". */
const SHOWN = 6;
const MAX_ROWS = 8;

export default async function InstructorConsole({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole("instructor");
  const params = await searchParams;
  // Old links put the student on this page. The student view now has its own address.
  if (params.student) redirect(`/lab/instructor/student/${encodeURIComponent(params.student)}${params.attempt ? `?attempt=${encodeURIComponent(params.attempt)}` : ""}`);

  const sections = await mySections();
  const sectionId = params.section ?? (sections.some((s) => s.id === "B") ? "B" : sections[0]?.id);
  const section = sections.find((s) => s.id === sectionId);

  const tabs = sections.length > 1 && (
    <nav className="ic-tabs" aria-label="Your sections" data-testid="section-tabs">
      {sections.map((s) => (
        <Link key={s.id} href={sectionHref(s.id)} className="ic-tab" aria-current={s.id === sectionId ? "page" : undefined} data-testid={`section-tab-${s.id}`}>
          {s.name}
        </Link>
      ))}
    </nav>
  );

  if (!section) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="eyebrow">Instructor console</div>
            <h1>Your sections</h1>
          </div>
          {tabs}
        </div>
        <div className="notice notice-warn" data-testid="no-access">
          {sections.length ? "You don't teach that section, so there is nothing to show." : "You have no sections yet."}
        </div>
      </>
    );
  }

  const overview = await sectionOverview(section.id);
  const ids = overview.students.map((s) => s.id);
  const [needs, ready, reliability] = await Promise.all([needsYouToday(overview), unreleasedCount(ids), coachReliability()]);
  const names = new Map(overview.students.map((s) => [s.id, s.display_name]));

  return (
    <div className="ic">
      <div className="page-head">
        <div>
          <div className="eyebrow">Instructor console{section.cycle ? ` · ${section.cycle}` : ""}</div>
          <h1>{section.name}</h1>
          <div className="row small muted">
            <span>{overview.students.length} students</span>
            <SampleTag />
          </div>
        </div>
        {tabs}
      </div>

      <NeedsYou rows={needs} names={names} lessonSkill={overview.miniLesson?.skill ?? null} />

      <div className="grid grid-2 ic-pair">
        {overview.miniLesson ? <MostMissed lesson={overview.miniLesson} primary={needs.length === 0} /> : <section className="card" data-testid="mini-lesson"><p className="muted">Not enough practice yet to pick a check to teach.</p></section>}
        <LiftPanel lift={overview.lift} students={overview.students.length} />
      </div>

      <Heatmap overview={overview} />

      <div className="grid grid-2 ic-pair">
        <section className="card" data-testid="gradebook">
          <h3>Gradebook</h3>
          <p className="small muted">
            {ready === 0
              ? "Every scored attempt has been sent."
              : `${ready} scored ${ready === 1 ? "attempt is" : "attempts are"} ready to send. Scores that need your review stay back until you check them.`}
          </p>
          <SendToGradebook sectionId={section.id} disabled={ready === 0} />
        </section>
        <Reliability data={reliability} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- needs you today

const KIND_TAG: Record<NeedsYouRow["kind"], string> = {
  support: "tag-fail",
  class: "tag-warn",
  stuck: "tag-warn",
  review: "tag-info",
  safety: "tag-quiet",
};

const ROW_ACTION: Record<NeedsYouRow["kind"], string> = {
  support: "See what happened",
  class: "See mini-lesson",
  stuck: "See where they're stuck",
  review: "Review the score",
  safety: "See details",
};

function NeedsYou({ rows, names, lessonSkill }: { rows: NeedsYouRow[]; names: Map<string, string>; lessonSkill: Skill | null }) {
  const nameOf = (id: string) => names.get(id) ?? id;
  const row = (r: NeedsYouRow, i: number) => {
    const btn = `btn ${i === 0 ? "btn-primary" : ""}`;
    if (r.kind === "class") {
      const list = r.students ?? [];
      const shown = list.slice(0, 3).map(nameOf).join(", ");
      return (
        <li key={`class-${r.skill}`} className="ic-need" data-testid="needs-you-row" data-kind={r.kind}>
          <div className="ic-need-who">
            <span>Whole section</span>
            <span className="tiny muted">{list.length} students</span>
          </div>
          <div className="ic-need-what">
            <div className="row ic-need-head">
              <span className={`tag ${KIND_TAG[r.kind]}`}>{r.headline}</span>
            </div>
            <div className="small">{r.detail}</div>
            <div className="tiny muted">
              {shown}
              {list.length > 3 && ` and ${list.length - 3} more`}
            </div>
          </div>
          <a href={r.skill === lessonSkill ? "#mini-lesson" : "#heatmap"} className={btn}>
            {r.skill === lessonSkill ? "See mini-lesson" : "See students"}
          </a>
        </li>
      );
    }
    return (
      <li key={r.student_id} className="ic-need" data-testid="needs-you-row" data-kind={r.kind}>
        <div className="ic-need-who">
          <Link href={studentHref(r.student_id)}>{nameOf(r.student_id)}</Link>
          <span className="tiny muted">{r.student_id}</span>
        </div>
        <div className="ic-need-what">
          <div className="row ic-need-head">
            <span className={`tag ${KIND_TAG[r.kind]}`}>{r.headline}</span>
            {r.exercise_id && <span className="small muted">in {exerciseTitle(r.exercise_id)}</span>}
          </div>
          <div className="small">{r.detail}</div>
          {r.also.length > 0 && <div className="tiny muted">Also: {r.also.join(", ")}</div>}
        </div>
        <Link href={`${studentHref(r.student_id, r.attempt_id)}#why`} className={btn}>
          {ROW_ACTION[r.kind]}
        </Link>
      </li>
    );
  };
  const people = new Set(rows.flatMap((r) => (r.students?.length ? r.students : [r.student_id])).filter(Boolean)).size;

  return (
    <section className="card" data-testid="needs-you">
      <div className="row between ic-card-head">
        <h2>Needs you today</h2>
        {rows.length > 0 && (
          <span className="small muted ic-num">
            {people} {people === 1 ? "student" : "students"}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Nothing needs you today. No one is stuck, no safety flags are open and no scores are waiting for review.
        </p>
      ) : (
        <>
          <ul className="ic-needs">{rows.slice(0, rows.length <= MAX_ROWS ? rows.length : SHOWN).map(row)}</ul>
          {rows.length > MAX_ROWS && (
            <details className="ic-more">
              <summary>Show {rows.length - SHOWN} more</summary>
              <ul className="ic-needs">{rows.slice(SHOWN).map((r, i) => row(r, i + SHOWN))}</ul>
            </details>
          )}
          <p className="tiny muted ic-foot">Stuck means under 40% on a skill across their last 3 practice attempts that test it.</p>
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
    <section className="card" data-testid="mini-lesson" id="mini-lesson">
      <div className="eyebrow">Most-missed check</div>
      <h2>{check.text.replace(/\?$/, "")}</h2>
      <p className="small muted">
        {who}
        {students > 0 && ` Whole section: ${percent(section.rate)} of ${section.n} tries.`}
      </p>
      <div className="tip">
        <div className="eyebrow ic-tip-label">10-minute mini-lesson</div>
        <div className="small">{plainCurriculum(check.miniLesson)}</div>
      </div>
      <div className="ic-actions">
        <AssignMiniLesson title={check.text.replace(/\?$/, "")} primary={primary} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- starting point to now

function LiftPanel({ lift, students }: { lift: Lift; students: number }) {
  const any = lift.tookBoth > 0;
  const met = lift.lift !== null && lift.lift >= LIFT_GOAL;
  return (
    <section className="card" data-testid="lift-panel">
      <div className="eyebrow">Starting point to final check</div>
      <div className="row between ic-lift-head">
        {any ? (
          <div>
            <span className="stat" data-testid="lift-value">{signedPercent(lift.lift)}</span> <span className="stat-label">average lift</span>
          </div>
        ) : (
          <div className="stat-label">No one has taken the final check yet.</div>
        )}
        <span className={`tag ${met ? "tag-pass" : "tag-quiet"}`}>{met ? "Goal met: " : "Goal: "}{signedPercent(LIFT_GOAL)}</span>
      </div>

      <ul className="ic-lift">
        {lift.bySkill.map((r) => {
          const l = liftOf(r.start, r.final);
          const goal = r.start === null ? null : Math.min(1, r.start * (1 + LIFT_GOAL));
          return (
            <li key={r.skill} data-testid={`lift-${r.skill}`}>
              <div className="ic-lift-row">
                <span>{SKILL_LABELS[r.skill]}</span>
                <span className="ic-num">
                  {percent(r.start)} <span className="muted">to</span> {percent(r.final)}
                </span>
                <span className={`ic-num ic-lift-delta ${l !== null && l >= LIFT_GOAL ? "is-met" : ""}`}>{any ? signedPercent(l) : ""}</span>
              </div>
              <div className="ic-bars" aria-hidden>
                <div className="bar ic-bar-start">
                  <span style={{ width: `${Math.round((r.start ?? 0) * 100)}%` }} />
                </div>
                <div className="bar ic-bar-final">
                  <span style={{ width: `${Math.round((r.final ?? 0) * 100)}%` }} />
                </div>
                {goal !== null && any && <i className="ic-goal" style={{ left: `${Math.round(goal * 100)}%` }} title="Goal" />}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="legend ic-legend">
        <span style={{ ["--c" as string]: "var(--faint)" }}>Starting point</span>
        <span style={{ ["--c" as string]: "var(--accent)" }}>Final check</span>
        {any && <span className="ic-legend-goal">Goal</span>}
      </div>
      <p className="tiny muted ic-foot">
        {any
          ? `Average of the ${lift.tookBoth} students who took both. ${lift.tookStart} of ${students} took the starting point; ${lift.tookFinal} took the final check. Lift is how much higher the final score is than the starting score.`
          : `${lift.tookStart} of ${students} students took the starting point. The comparison appears once students take the final check.`}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- heatmap (secondary)

function Heatmap({ overview }: { overview: SectionOverview }) {
  return (
    <details className="card ic-heat" data-testid="heatmap" id="heatmap">
      <summary>
        <span className="ic-heat-title">All students by skill</span>
        <span className="small muted">Practice pass rate, last 3 attempts on each skill</span>
      </summary>
      <div className="ic-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              {SKILLS.map((s) => (
                <th key={s} className="ic-center">
                  {SKILL_LABELS[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {overview.students.map((st) => {
              const lv = overview.levels.get(st.id);
              return (
                <tr key={st.id} data-testid={`heat-row-${st.id}`}>
                  <td className="ic-nowrap">
                    <Link href={studentHref(st.id)}>{st.display_name}</Link> <span className="tiny muted">{st.id}</span>
                  </td>
                  {SKILLS.map((s) => {
                    const c = lv?.[s].current ?? null;
                    return (
                      <td key={s}>
                        <div className={`heat ${heatClass(c)}`} title={`${SKILL_LABELS[s]}: ${c === null ? "no practice yet" : percent(c)}`}>
                          {percent(c)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="row tiny muted ic-key">
        <span className="heat heat-0">Under 40%</span>
        <span className="heat heat-2">55 to 69%</span>
        <span className="heat heat-4">85% or more</span>
        <span className="heat heat-na">No practice yet</span>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- coach reliability

function Reliability({ data }: { data: CoachReliability }) {
  const { grading, safety } = data;
  return (
    <section className="card card-muted" data-testid="coach-reliability">
      <h3>Coach reliability</h3>
      {!grading && !safety ? (
        <p className="small muted" style={{ margin: 0 }}>
          Not measured yet.
        </p>
      ) : (
        <>
          <dl className="ic-kv">
            {grading && (
              <div>
                <dt>Agrees with human graders</dt>
                <dd>
                  <span className="ic-num">{percent(grading.agreement)}</span>
                  <span className={`tag ${grading.passed ? "tag-pass" : "tag-fail"}`}>{grading.passed ? "Above" : "Below"} the {percent(grading.gate)} bar</span>
                </dd>
              </div>
            )}
            {safety && (
              <div>
                <dt>Safety cases handled correctly</dt>
                <dd>
                  <span className="ic-num">
                    {safety.passed} of {safety.total}
                  </span>
                  <span className={`tag ${safety.ok ? "tag-pass" : "tag-fail"}`}>{safety.ok ? "All passed" : "Not all passed"}</span>
                </dd>
              </div>
            )}
          </dl>
          <p className="tiny muted" style={{ margin: 0 }}>
            {grading
              ? `Measured ${shortDate(grading.at)} on ${grading.heldOutChecks ? `${grading.heldOutChecks} held-out checks` : "held-out checks"} that were not used to tune the coach. You can still change any score.`
              : `Measured ${shortDate(safety!.at)}.`}
          </p>
        </>
      )}
    </section>
  );
}
