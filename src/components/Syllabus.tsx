"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { CourseGroup } from "@/lib/curriculum/course";
import type { StepState } from "@/lib/progress";

const KIND = { check: "Check", lesson: "Lesson", practice: "Practice", skills: "Summary" } as const;

/** Coursera-style syllabus: modules, steps, minutes and checkmarks. Highlights the current page. */
export function Syllabus({ groups, states, done, total }: { groups: CourseGroup[]; states: Record<string, StepState>; done: number; total: number }) {
  const path = usePathname();
  // On phones the outline is collapsed so the page's one action stays on the first screen.
  const [open, setOpen] = useState(false);
  return (
    <aside className={`syllabus${open ? " open" : ""}`} aria-label="Course outline">
      <div className="syllabus-head">
        <Link href="/lab" style={{ color: "var(--ink)", fontWeight: 600 }}>AI Foundations</Link>
        <div className="tiny muted" style={{ margin: "4px 0 8px" }}>{done} of {total} steps done</div>
        <div className="bar bar-ok" aria-hidden><span style={{ width: `${Math.round((done / total) * 100)}%` }} /></div>
        <button type="button" className="btn btn-subtle syllabus-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide course outline" : "Show course outline"}
        </button>
      </div>
      {groups.map((g) => (
        <div key={g.id} className="syllabus-group">
          <div className="syllabus-title">{g.title}</div>
          {g.steps.map((s) => {
            const st = states[s.id];
            const active = path === s.href || path.startsWith(s.href + "/");
            return (
              <Link key={s.id} href={s.href} onClick={() => setOpen(false)} className={`step${active ? " active" : ""}`} aria-current={active ? "page" : undefined} data-testid={`step-${s.id}`}>
                <span className={`step-dot${st?.done ? " done" : active ? " now" : ""}`} aria-label={st?.done ? "Done" : "Not done"}>
                  {st?.done ? "✓" : ""}
                </span>
                <span>
                  {s.title}
                  <span className="step-meta">
                    {KIND[s.kind]} · {s.minutes} min
                    {s.kind === "practice" && st?.best && !st.done ? ` · best ${st.best.passed}/${st.best.total}` : ""}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
