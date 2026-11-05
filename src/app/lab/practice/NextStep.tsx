"use client";

import Link from "next/link";
import { PASS_MARK } from "@/lib/curriculum/course";
import type { AttemptView } from "@/lib/attempts";

export interface NextLink {
  title: string;
  href: string;
}

/** True when an attempt passed at least the course pass mark of its checks (80%). */
export function attemptPassed(a: Pick<AttemptView, "passed" | "total"> | null | undefined): boolean {
  return !!a && a.passed !== null && !!a.total && a.passed / a.total >= PASS_MARK;
}

/** Shown once a practice task is passed: the one primary action on the screen. */
export function NextStep({ next }: { next: NextLink | null }) {
  return (
    <section className="up-next" data-testid="practice-passed">
      <div>
        <div className="eyebrow">Passed</div>
        <p style={{ margin: 0 }}>
          {next ? "You passed this task. Keep improving it if you like, or move on." : "You passed the last practice task."}
        </p>
      </div>
      {next && (
        <Link href={next.href} className="btn btn-primary btn-lg" data-testid="next-step">
          Next: {next.title}
        </Link>
      )}
    </section>
  );
}
