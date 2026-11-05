# Module 01 — Prompting Foundations

> SOURCE OF TRUTH. The module chatbot may only teach what is written here.
> Section ids (M01-S1 … ) are the citation keys students and the chatbot must use.

## M01-S1 — What a prompt is

A prompt is the full set of instructions and context you give an AI model before it
responds. At Year Up United we treat a prompt as **three parts, always in this order**:

1. **Role** — who the model is acting as.
2. **Task** — the single outcome you want.
3. **Guardrails** — what it must not do, and what "done" looks like.

We call this the **R-T-G pattern**. Students are graded on writing prompts in R-T-G
order. A prompt missing any of the three parts is incomplete, even if the output
looks fine.

## M01-S2 — The four-pass revision loop

No prompt is finished on the first try. The module teaches a fixed four-pass loop:

- **Pass 1 — Run it plain.** Send the prompt with no examples. Note what is wrong.
- **Pass 2 — Add one example.** Exactly one. More than one at this stage hides which
  change helped.
- **Pass 3 — Tighten the guardrail.** Rewrite only the G of R-T-G.
- **Pass 4 — Shrink.** Delete every word that did not change the output.

Students stop at pass 4. The module does not teach a fifth pass. If a prompt is still
wrong after pass 4, the task is wrong, not the prompt, and the student restarts at
M01-S1.

## M01-S3 — Context is not memory

The model does not remember earlier conversations unless that text is sent again. In
this course, anything the model needs must be in the current prompt or the current
conversation. Students must never assume the model "knows" a document it saw in an
earlier session.

## M01-S4 — Specificity beats politeness

"Please could you kindly help me maybe write something about budgets" scores 0 on the
module rubric. "Write a 150-word budget summary for a non-technical board member,
using only the figures in the attached table" scores full marks. Courtesy words do not
improve output quality. Measurable constraints do.

## M01-S5 — The prompting rubric

Every student prompt submission is scored out of 10:

| Criterion | Points |
|---|---|
| Role stated | 2 |
| Task is a single outcome | 3 |
| Guardrails include a "done" condition | 3 |
| Under 200 words | 2 |

A submission under 6/10 must be revised before the student moves to Module 02.

## M01-S6 — When not to use AI

The module teaches three stop conditions. Do not use AI when:

1. You cannot check the answer yourself.
2. The input contains someone else's personal data.
3. A wrong answer cannot be undone.

These three stop conditions apply in every discipline and are repeated in Modules 02
and 03. They are the course's transferable rule.
