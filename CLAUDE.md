# Year Up United AI Lab (prototype)

Claude Corps / Basecamp build for Year Up United. Source PRD: "PRD: Year Up United AI Lab" (Nov 5, 2026, Ethan White and Logan Kay). Host: Ryan Sanders (Solutions Architect).

## What it is

One secure place, opened from a (simulated) Brightspace course, where Year Up students practice three AI skills with a Claude coach, and instructors see who understands what.

Flow: simulated Year Up sign-in (`/`, two accounts: Jasmine Carter, student; Ms. Rivera, instructor) -> Brightspace home (`/home`) -> the AI Lab, a Coursera-style course player (`/lab`, left syllabus from `src/lib/curriculum/course.ts`):

- **Starting point check** (`/lab/check/start`): 4 short coached tasks, one per fluency skill, not graded. The **final check** (`/lab/check/final`) is a parallel form, so the lift is measured fairly (`src/lib/curriculum/skill-checks.ts`).
- **Module 1, Writing prompts (Prompt Studio):** lesson with an annotated worked example, then 3 practice tasks: write a prompt, see the output, get scored and coached, retry.
- **Module 2, Comparing models (Model Arena):** lesson, then a guided 3-step flow: one prompt on Haiku, Sonnet and Opus, compare, pick and explain why.
- **Module 3, Building a bot (Agent Builder):** lesson, then write a bot's instructions, test it on 3 scripted coworker messages, fix what breaks.
- Around them: the skills page and badge (`/lab/skills`), the instructor console (`/lab/instructor`), a read-only MCP server. Curriculum and admin roles exist in the data layer and access tests only (no screens in this demo).

The one thing this prototype must prove: **a Claude coach can grade students' AI work reliably.** Gate: at least 80% agreement with human labels on yes/no rubric checks (held-out set), and 20/20 on the safety set.

## Rules (from the PRD, do not weaken)

- Sample data only. Every screen shows a "Sample data" tag; every simulated connection (Brightspace launch, gradebook sync, Year Up sign-in) is labeled "Simulated".
- The coach never writes the student's answer, answers only about the current lesson, quotes the student's own words as evidence for every check, and gives exactly one tip.
- Every evidence quote is verified in code against the student's text (`src/lib/coach/verify.ts`). A quote that is not found means "needs instructor review", never an automatic pass.
- Student names are replaced with pseudonymous IDs, and PII is stripped, before any Claude call (`src/lib/coach/privacy.ts`).
- Distress messages skip the coach, show the pre-written staff-contact message, and raise a safety flag (`src/lib/coach/distress.ts`).
- The coach only drafts scores. Instructors can see and override every one; grades "sync" only after instructor release.
- Access rules enforce the four roles in the data layer (`src/lib/demo/client.ts`, ported from the Postgres RLS policies in `supabase/migrations/`). Pages never filter by role themselves.
- Daily token budget per student and a monthly spend cap (`src/lib/coach/budget.ts`). If Claude is down, the attempt is saved as `pending_score` and scored later.
- Never commit `.env*` files or API keys (git pre-commit hook in `.githooks/` and a Claude Code hook in `.claude/`).

## Stack

- Next.js 16 (App Router, TypeScript) in `src/app`. Plain CSS with Brightspace-style tokens in `src/app/globals.css`.
- No backend for the demo: an in-memory store (`src/lib/demo/`) seeded with deterministic sample data on start, behind the same access rules as the RLS policies. On Vercel, changes are shared between instances through an append-only log in Upstash Redis (`src/lib/demo/sync.ts`, free plan). Every write to an existing row must go through `patchRow`/`deleteRows` in `store.ts` so it is logged. `supabase/migrations/` is the pilot's Postgres design (not used by the demo).
- Claude API via `@anthropic-ai/sdk`. Models are set in `src/lib/models.ts` (grading default `claude-haiku-5-5`; Arena compares `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`). Structured outputs via `client.messages.parse` + `zodOutputFormat`. Lesson, rubric and rules are cached with `cache_control`.
- No sampling params (`temperature` etc.): they 400 on current models.
- Evals: `npm run eval` (TypeScript, imports `src/lib/coach`); legacy lesson-Q&A eval in `eval/run_eval.py`.
- MCP: `mcp/server.ts` (stdio, read-only, acts as a persona so the access rules apply).

## Commands

```bash
npm install
npm run dev                 # http://localhost:3000
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e            # Playwright demo script
npm run eval                # coach grading + safety evals (spends a little API money)
```

## Git

Work on the `logan` branch. One commit per feature, in the PRD build order. Do not push or merge to `main` without asking.

## Sample curriculum

`eval/corpus/module-0{1,2,3}-*.md` is placeholder curriculum (R-T-G prompting, Fit/Trust/Cost model comparison, Job/Tools/Stop/Handoff agent spec). Lessons and rubrics in `src/lib/curriculum/` are built on it. When Year Up's real lessons arrive, replace the corpus and the exercises, then rerun the evals.
