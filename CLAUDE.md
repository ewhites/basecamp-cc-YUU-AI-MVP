# Year Up United AI Lab (prototype)

Claude Corps / Basecamp build for Year Up United. Source PRD: "PRD: Year Up United AI Lab" (Nov 5, 2026, Ethan White and Logan Kay). Host: Ryan Sanders (Solutions Architect).

## What it is

One secure place where Year Up students practice five AI skills with a Claude coach, facilitators see who understands what, and an admin watches cost. Requirements: the PRD plus the WCR AI SIM spec (`docs/redesign/REQUIREMENTS-WCR.md`). It is **not** delivered through Brightspace any more (Logan, 2026-11-19): no Brightspace page, launch or gradebook sync.

Flow: simulated Year Up sign-in (`/`, three accounts: Jasmine Carter, student; Ms. Rivera, facilitator; Sam Lee, admin). `/home` only redirects to each role's start page. A student's first visit (`/lab/welcome`, one question a screen: welcome, acceptable use, kind of work, AI experience, where to start; answers in the `ailab_intro` cookie, `src/app/lab/intro.ts`) leads to the course home (`/lab`: progress bar, up next, three module doors, every step as a row). The five skills: prompting, validation, context engineering, comparing models, responsible use (`src/lib/curriculum/types.ts`).

- **Starting point check** (`/lab/check/start`): 5 short coached tasks, one per skill, not graded. The **final check** (`/lab/check/final`) is a parallel form, so the lift is measured fairly (`src/lib/curriculum/skill-checks.ts`).
- **Module 1, Writing prompts (Prompt Studio):** lesson with a worked example and a scripted "Watch demo" (no model call), then 3 practice tasks: write a prompt, see the output, get scored and coached, retry.
- **Module 2, Comparing models (Model Arena):** lesson, then a guided 3-step flow: one prompt on Haiku, Sonnet and Opus, compare, pick and explain why.
- **Module 3, Building an agent (Agent Builder sandbox):** lesson, two scripted demos (Research assistant, Travel planner; no model calls, `src/lib/sandbox/demos.ts`) with simulated tools (spreadsheet, outbox, notes doc, memory) and a person approving the outbox, then one live build (`ab-newhire-it`): the student picks tools and writes instructions; the bot runs with only those tools (`src/lib/sandbox/run.ts`). A code check rewards giving only the tools the job needs.
- The coach is a side panel on every lesson, practice and check screen: score, checks with quotes, one tip, and a chat about the current lesson. A line warns when typed text looks like personal data.
- Around them: skills and badge (`/lab/skills`), How it works (`/lab/how-it-works`: access and history, the sandbox, tokens and cost), the facilitator console (`/lab/instructor`), the admin cost view (`/lab/admin`: spend against the monthly budget with 50/80/100% alerts, totals only), a read-only MCP server. Facilitators change one student's daily token limit with a reason on the student page (`cap_overrides`, logged). The curriculum role exists in the data layer and access tests only.

The one thing this prototype must prove: **a Claude coach can grade students' AI work reliably.** Gate: at least 80% agreement with human labels on yes/no rubric checks (held-out set), and 20/20 on the safety set.

## Rules (from the PRD, do not weaken)

- Sample data only. Every screen shows a "Sample data" tag; every simulated connection or tool (Year Up sign-in, course calendar, the sandbox tools) is labeled "Simulated".
- The coach never writes the student's answer, answers only about the current lesson, quotes the student's own words as evidence for every check, and gives exactly one tip.
- Every evidence quote is verified in code against the student's text (`src/lib/coach/verify.ts`). A quote that is not found means "needs facilitator review", never an automatic pass.
- Student names are replaced with pseudonymous IDs, and PII is stripped, before any Claude call (`src/lib/coach/privacy.ts`).
- Distress messages skip the coach, show the pre-written staff-contact message, and raise a safety flag (`src/lib/coach/distress.ts`).
- The coach only drafts scores. Facilitators (role `instructor` in the data layer) can see and override every one; students see a score only after a facilitator releases it.
- Access rules enforce the four roles in the data layer (`src/lib/demo/client.ts`, ported from the Postgres RLS policies in `supabase/migrations/`). Pages never filter by role themselves.
- Daily token budget per student and a monthly spend cap (`src/lib/coach/budget.ts`). If Claude is down, the attempt is saved as `pending_score` and scored later.
- Never commit `.env*` files or API keys (git pre-commit hook in `.githooks/` and a Claude Code hook in `.claude/`).

## Stack

- Next.js 16 (App Router, TypeScript) in `src/app`. Design system in `src/design/` (the Kaleos HQ look in Year Up colours): every colour, size and curve in `tokens.css` (a test fails on any colour value elsewhere), `base.css`, `components.css`, components (TopBar, Dock, Sheet, CoachPanel, Section, Panel, RowLink, Fold, Crumbs, Button, and the stretchy controls) and one stylesheet per page area in `src/design/areas/`. Rules: `docs/redesign/DESIGN-RULES.md` (rules 32 to 40 cover headings, sections and what looks clickable). `/design` shows every component.
- Checks beyond the unit tests: `node scripts/shots.mjs <dir> [filter]` (screenshots of every route), `node scripts/a11y.mjs` (axe WCAG 2.2 AA and 320px sideways scroll). Both need the dev server.
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
