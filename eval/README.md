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
eval/app/chatbot.py PLACEHOLDER entry point — swap for the real app
eval/grader.py      programmatic citation check + two judge calls per case
eval/run_eval.py    the runner
.claude/hillclimb/module-chatbot/  results, traces, errors, report
```

## Running

```bash
export ANTHROPIC_API_KEY=...            # or: ant auth login
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
3. Replace the body of `answer()` in `eval/app/chatbot.py` with a call to the real
   chatbot entry point. Keep the return shape.
4. Have Ryan Sanders label 15–20 cases by hand, then compare his labels to the judge's.
   Below ~90% agreement, the rubric needs another pass before the number means anything.

## Known limits

- The corpus is a **placeholder**. Every number produced before real curriculum lands
  describes the placeholder, not the course.
- The judge is Claude Sonnet 5.5 and the system under test is Claude Opus 5.5. Different
  models, same family — some self-preference is possible. Ryan's hand labels are the
  check on this.
- 32 cases × 2 reps gives a noise floor of roughly ±12 points on a binary metric. Fine
  for catching a broken chatbot; too coarse to resolve a 5-point improvement. Raise reps
  or cases before trying to hill-climb on small gains.
