import { BrightspaceChrome } from "@/components/BrightspaceChrome";
import { SampleTag, SimulatedTag } from "@/components/Tags";
import { PERSONAS } from "@/lib/personas";

/** SIMULATED Brightspace course home for "AI Foundations", with the "Open AI Lab" link. */
export default async function CourseHome({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <BrightspaceChrome
        showSwitcher={false}
        active="/"
        links={[
          { href: "/", label: "Course Home" },
          { href: "/", label: "Content" },
          { href: "/", label: "Assignments" },
          { href: "/", label: "Grades" },
          { href: "/", label: "Classlist" },
        ]}
      />
      <main className="page">
        {error && <div className="notice notice-fail" style={{ marginBottom: "1rem" }}>{error}</div>}
        <div className="split">
          <section className="card">
            <div className="row" style={{ marginBottom: "0.4rem" }}>
              <h1 style={{ margin: 0 }}>AI Foundations</h1>
              <SimulatedTag what="course page" />
            </div>
            <p className="muted">Unit 4 · AI fluency: prompting, model comparison and agent building</p>
            <div className="card card-muted">
              <h2>Announcements</h2>
              <p className="small">
                <b>This week:</b> all AI-unit practice happens in the AI Lab. Open it from the link on the right. Your work
                is saved, your coach scores every attempt, and your instructor can see your progress. Don&apos;t use personal AI
                accounts for coursework.
              </p>
            </div>
            <h2 style={{ marginTop: "1rem" }}>Unit 4 content</h2>
            <ul className="small" style={{ paddingLeft: "1.1rem" }}>
              <li>Module 01: Prompting foundations (R-T-G, the four-pass loop)</li>
              <li>Module 02: Comparing AI models (Fit, Trust, Cost)</li>
              <li>Module 03: Building an agent (Job, Tools, Stop rule, Handoff)</li>
            </ul>
          </section>

          <section className="card">
            <div className="row between">
              <h2 style={{ margin: 0 }}>Open AI Lab</h2>
              <SampleTag />
            </div>
            <p className="small muted" style={{ marginTop: "0.4rem" }}>
              In the pilot, this link launches the Lab from Brightspace with your Year Up sign-in (LTI 1.3 + Azure SSO).
              For the demo, pick an account. Each opens the Lab signed in with that role.
            </p>
            <div className="stack">
              {PERSONAS.map((p) => (
                <a key={p.key} href={`/launch?as=${p.key}`} className="card card-muted row between" style={{ textDecoration: "none", color: "inherit" }} data-testid={`launch-${p.key}`}>
                  <span>
                    <b>{p.name}</b>
                    <br />
                    <span className="small muted">{p.description}</span>
                  </span>
                  <span className="btn btn-primary">Open AI Lab</span>
                </a>
              ))}
            </div>
            <p className="small muted" style={{ marginTop: "0.8rem" }}>
              All names are invented. Sign-in is simulated with one-time tokens; no passwords exist.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
