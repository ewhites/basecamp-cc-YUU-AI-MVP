"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markLessonDoneAction } from "@/app/lab/actions";

/** The lesson's one primary action: mark the lesson done, then open the module's first practice task. */
export function StartPractice({ stepId, href }: { stepId: string; href: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-primary btn-lg"
      disabled={pending}
      data-testid="start-practice"
      onClick={() =>
        start(async () => {
          try {
            await markLessonDoneAction(stepId);
          } catch {
            // Progress is a convenience; never block the student from practicing.
          }
          router.push(href);
        })
      }
    >
      {pending ? "Opening practice…" : "Start practice"}
    </button>
  );
}
