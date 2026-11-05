# Grading labels: who wrote them, and why a person must check them

`grading.jsonl` has 40 invented student attempts and a yes/no label for every coach check on
each one (252 labels). **These labels were written by Claude, the same AI that built the coach.**
Until a person reviews them, the eval measures "does the coach agree with another Claude", not
"does the coach agree with a Year Up instructor". That is the self-grading risk:

- The same model family can share the same blind spots, so both can be wrong together and the
  agreement still looks high.
- The labeler knew how the coach prompt reads each check, so labels may drift toward what the
  coach will say rather than what an instructor would say.

The PRD gate (80% agreement on the held-out split) only means something after a human signs off
on the labels. **Logan and Ethan (or an instructor they choose) must review them before the
number is shown to Year Up as evidence.**

## Review checklist

Do this before the first live eval result is reported anywhere.

- [ ] Read every case in the **test split** (8 cases: gc-03, gc-07, gc-11, gc-20, gc-21, gc-31, gc-35, gc-38). These decide the gate. Relabel anything you disagree with.
- [ ] Read at least 10 dev cases, at least one per studio, and relabel where needed.
- [ ] Decide each judgment call below (keep, flip, or reword the check's `guidance` in `src/lib/curriculum/checks.ts`).
- [ ] Check the attempts sound like real Year Up trainees (18-29, typos, vague phrasing). Swap any that don't.
- [ ] Check no case uses a real person's name, phone number, email or ID. All of them must be invented.
- [ ] Run `npm run eval -- --dry-run` and confirm "Dataset check passed".
- [ ] Write your name and the date at the bottom of this file, then commit.
- [ ] Only then run the live eval (`npm run eval`) and report the held-out number.

Label against each check's `guidance` text in `src/lib/curriculum/checks.ts`, **before** you look
at what the coach said. Never flip a label because the coach disagreed; flip it only if the label
was wrong against the guidance. Otherwise the eval just learns to agree with the coach.

## Judgment calls the labeler made (please decide these)

These are the places two careful people could disagree. Each is labeled one way on purpose; if you
see it differently, flip the label or tighten the guidance so the next person doesn't have to guess.

| Case | Check | Label | Why it is a judgment call |
|---|---|---|---|
| gc-05 | done_condition | false | The only "don't" in the prompt is a privacy line ("Leave out Dana's ID and phone"). We counted privacy lines under `protects_personal_data` only, not as the task guardrail. A literal reading of the guidance ("something the AI must not do") would say true. |
| gc-17 | names_pick | true | "It sounded the most professional" is a thin reason. Labeled true because the coach's own worked example in `src/lib/coach/prompt.ts` passes the same reason. |
| gc-18 | names_pick | true | The reason is cost and volume ("cheapest... 400 new hires a year"), not how well the output did the task. |
| gc-20 | judges_trust | false | "It seems accurate" talks about accuracy but shows no check against the source. |
| gc-21, gc-26 | trust_tiebreak | false | Both pick the cheap model while admitting it was less accurate. gc-26 adds "agents check every draft anyway", which some reviewers may accept as a reason. |
| gc-35 | handled_out_of_scope | false | The bot declined the patient-appointment request but sent it to Facilities, which is the wrong team for patient scheduling. |
| gc-36 | handled_tricky | false | The bot refused the Lighthouse request but did not point to the approval path, which the guidance requires. |
| gc-32 | handled_tricky | true | The bot refused and sent the person to the IT Service Desk rather than the manager-approved ticket process. Counted as the right path because the Service Desk handles anything not in the guide. |
| gc-40 | job | true | "Expense bot for Northwind" is a fragment, but it does say what the bot is for and who it serves. |
| gc-12, gc-15 | audience | true | "Reply to this angry guy" / "write something back to this customer" name the reader only by implication of the task. |

## How to relabel

1. Open `eval/coach/grading.jsonl`. Each line is one case; `labels` has one `true`/`false` per coach check.
   (Code-decided checks like `under_200_words` are never labeled.)
2. Change the value. Keep the JSON on one line.
3. Run `npm run eval -- --dry-run`. It fails if a check is missing a label, a label is not a real
   check, the held-out split is not exactly 8 cases over all three studios, the groups are
   unbalanced, any check loses all its true or all its false examples, or the overall true rate
   leaves 40-65%.
4. Run `npx vitest run src/lib/evals` (the same rules as a test).
5. To add a case: copy a line, give it a new `id`, keep `split: "dev"` unless you are deliberately
   rebalancing the held-out set, and pick the `group` that keeps the two groups even.
   Groups are invented and only exist for the fairness check.

If you change a check's wording or guidance in `checks.ts`, re-read that check's labels: the label
must match the new guidance, and the coach prompt version (`COACH_PROMPT_VERSION`) should be bumped.

## Sign-off

Reviewed by: ____________________  Date: __________
