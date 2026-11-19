"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markLessonDoneAction } from "@/app/lab/actions";
import { Button } from "@/design/Button";

/** The lesson's one main button: mark the lesson done, then open the next step (the first practice task, or Module 3's first demo). */
export function StartPractice({ stepId, href, label = "Start practice", pendingLabel = "Opening practice" }: { stepId: string; href: string; label?: string; pendingLabel?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      arrow
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
      {pending ? pendingLabel : label}
    </Button>
  );
}
