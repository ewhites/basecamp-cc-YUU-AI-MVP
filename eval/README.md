# Evals

Two evals live here.

1. **Coach evals** (`eval/coach/`, TypeScript, `npm run eval`): does the Claude coach grade
   students' work the way a human would (the PRD gate: 80% agreement on the held-out split),
   and does it hold the safety rules (20/20)? See "Coach evals" at the bottom.
2. **Module chatbot eval** (this section, Python): does the "Ask the coach" box teach only
   what the lessons teach?

# Module chatbot eval

Measures one thing: **does the course chatbot teach students the same answers the
modules teach, and nothing else?** This is the eval for project-plan non-goal #3 —
"It will not have a 'general' AI that can answer questions outside of the specific
exercises."

## Metrics

| Metric | Kind | What it means |
|---|---|---|
| `grounded` | binary | Every claim traces to the corpus; nothing contradicts it. **Headline metric.** |
| `scope` | binary | Right answer-vs-decline decision (both halves, on `partial` cases). |
| `citation` | binary | Cited section keys exist *and* support the claim. |
| `teaching` | 0–1 | Is it a good explanation for a student. Judged separately from fact. |

## Layout

```
eval/corpus/        the single source of truth the chatbot may teach from
eval/cases.jsonl    32 student questions + expectations
eval/INPUTS.md      human-readable review doc (this is what gets signed off)
eval/app/chatbot.py entry point: POSTs to the running app (/api/coach/ask → askCoach)
eval/grader.py      programmatic citation check + two judge calls per case
eval/run_eval.py    the runner
.claude/hillclimb/module-chatbot/  results, traces, errors, report
```

## Running

The eval calls the real app, so start it first. `answer()` in `eval/app/chatbot.py` POSTs each
question to `http://localhost:3000/api/coach/ask` (override with `LAB_APP_URL`), which runs
`askCoach()` from `src/lib/coach/qa.ts`: the same scrub, distress tripwire, prompt and model
(`QA_MODEL`, Haiku) students get. The route answers only in development and only with the
header `x-lab-eval: 1`; without an API key it returns HTTP 503 and the case lands in `errors.jsonl`.

```bash
npm run dev                             # terminal 1, with ANTHROPIC_API_KEY in .env.local
export ANTHROPIC_API_KEY=...            # terminal 2: the Python judge calls Claude directly
.venv/bin/python eval/run_eval.py --self-test        # grader sanity, no app calls
.venv/bin/python eval/run_eval.py --limit 5          # pilot
.venv/bin/python eval/run_eval.py --reps 3           # full pass
```

Resume is safe: rerunning skips `(case, rep)` pairs already in `results.jsonl`.

## When the real curriculum arrives

1. Replace `eval/corpus/*.md` with the real module content. Keep the `## MXX-SN — Title`
   heading format; it is what produces citation keys.
2. Rewrite `eval/cases.jsonl` against the real content. Keep the four case types and
   the answer/decline balance — that structure is the part that matters.
3. Nothing to change in `eval/app/chatbot.py`: it already calls the real app. If the Q&A
   coach moves, point `LAB_APP_URL` or the route at it and keep the return shape.
4. Have Ryan Sanders label 15–20 cases by hand, then compare his labels to the judge's.
   Below ~90% agreement, the rubric needs another pass before the number means anything.

## Known limits

- The corpus is a **placeholder**. Every number produced before real curriculum lands
  describes the placeholder, not the course.
- The judge is Claude Sonnet 5.5 and the system under test is the app's Q&A coach on
  Claude Haiku 5.5. Different models, same family: some self-preference is possible. Ryan's
  hand labels are the check on this.
- 32 cases × 2 reps gives a noise floor of roughly ±12 points on a binary metric. Fine
  for catching a broken chatbot; too coarse to resolve a 5-point improvement. Raise reps
  or cases before trying to hill-climb on small gains.

# Coach evals (`npm run eval`)

The PRD's proof point: a Claude coach can grade students' AI work reliably.

| File | What it is |
|---|---|
| `eval/coach/grading.jsonl` | 40 hand-written student attempts over all 9 exercises, each with a yes/no label per coach check. 8 are the held-out `test` split. |
| `eval/coach/safety.jsonl` | 20 cases built to break the rules: asks for the answer, off-topic, personal info, distress, prompt injection, tag escape. |
| `eval/coach/LABELS.md` | **Read this first.** The labels were written by the same AI that built the coach and must be reviewed by a person before the number means anything. |
| `eval/coach/run.ts` | The CLI. |
| `src/lib/evals/run.ts` | The runner library (`runGradingEval`, `runSafetyEval`), also used by the app's eval page. |
| `src/lib/evals/datasets.ts` | Loading, health rules and cost estimate, shared by the CLI, the runner and `datasets.test.ts`. |

```bash
npm run eval -- --dry-run          # validate both datasets + estimated cost. No API calls, no key needed.
npm run eval                       # grading (2 reps) + safety; saves to Supabase eval_runs and eval/reports/
npm run eval -- --grading --split test --reps 3
npm run eval -- --safety
npm run eval -- --grading --limit 5 --no-db   # quick pilot, not saved (a limited run never passes the gate)
```

Flags: `--grading` `--safety` (default both), `--split all|test`, `--reps N`, `--model ID`,
`--effort low|medium|high`, `--limit N`, `--no-db`, `--dry-run`. The key is read from the
environment, or from `.env.local` if unset.

**Grading eval.** Each case goes through the app's own steps (distress tripwire, personal-info
scrub, `gradeAttempt` with the same attempt/output shape per studio). The score is per-check
agreement between the coach's final `pass` (after quote verification, so a "needs review" check
counts as not passed) and the human label. Reported: held-out agreement (the gate, >= 80%),
dev and overall agreement, the always-fail baseline, consistency across reps, agreement per
invented group and the fairness gap, needs-review rate, per-check confusion (TP/FP/FN/TN),
cost and latency. Failed calls are recorded as errors, never as disagreements; any failed
held-out call fails the gate. A rubric-draft run (`draft` option, from the curriculum page) swaps
one check's wording and must also score >= 80% on that check itself.

**Safety eval.** Deterministic checks first (distress flag and coach never called, personal info
gone before the call, tags neutralized), then the real coach for the rest: the grader must still
fail weak work under an injection, must not echo personal info, and a Claude Sonnet 5.5 judge (a
different model from the Haiku coach) decides whether the Q&A coach declined or the tip avoided
writing the answer. Gate: 20/20.

**Noise.** 8 held-out cases x 6-7 checks x 2 reps is about 100 observations, so the held-out
number moves about +/-10 points on noise alone (more, since checks within a case are correlated).
Good enough to catch a broken coach; too coarse to tell 82% from 86%. Add cases before tuning.
