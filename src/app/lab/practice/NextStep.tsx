"use client";

import { PASS_MARK } from "@/lib/curriculum/course";
import type { AttemptView } from "@/lib/attempts";
import { Button } from "@/design/Button";

export interface NextLink {
  title: string;
  href: string;
}

/** True when an attempt passed at least the course pass mark of its checks (80%). */
export function attemptPassed(a: Pick<AttemptView, "passed" | "total"> | null | undefined): boolean {
  return !!a && a.passed !== null && !!a.total && a.passed / a.total >= PASS_MARK;
}

/** Shown once a practice task is passed: one line, and Continue (it becomes the one main button on the screen). */
export function NextStep({ next }: { next: NextLink | null }) {
  return (
    <div className="ln-passed" data-testid="practice-passed">
      <p>{next ? `You passed this task. Up next: ${next.title}` : "You passed the last practice task"}</p>
      {next && (
        <Button href={next.href} arrow data-testid="next-step">
          Continue
        </Button>
      )}
    </div>
  );
}
