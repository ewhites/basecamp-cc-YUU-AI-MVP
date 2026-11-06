# Year Up United AI Lab (prototype)

A working demo of the AI Lab from the PRD: one place, opened from a simulated Brightspace course, where students practice prompting, model comparison and agent building with a Claude coach, and instructors see who understands what.

**Everything is sample data.** Every screen says "Sample data". The Brightspace launch, Year Up sign-in and gradebook sync are simulated and labeled "Simulated".

## Run it

You need Node 20+ and an Anthropic API key. There is no database to set up: the demo keeps its data in memory, seeded with the same sample data on every start.

Put your API key in `.env.local` (never committed; a git hook blocks it). This prompts for it without echoing:

```bash
read -s "k?Anthropic API key: " && printf 'ANTHROPIC_API_KEY=%s\n' "$k" > .env.local && unset k
```

Then:

```bash
npm install
npm run dev                 # open http://localhost:3000
```

Set a monthly spend limit on the key in the Anthropic Console. The app also has its own guards.

### Environment variables

| Name | What it is |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key (required for coaching and evals) |
| `LAB_SIGNING_SECRET` | Signs demo session cookies, Arena results and portfolio links. Set a random value in production |
| `LAB_DEMO_LOGIN` | Set to `1` to allow the persona sign-in in a production build (local dev always allows it) |
| `LAB_DAILY_TOKEN_BUDGET_PER_STUDENT` | Daily token budget per student (default 60,000) |
| `LAB_MONTHLY_SPEND_CAP_USD` | Spend cap the app enforces (default $50) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Optional. Upstash Redis (free plan, added through the Vercel Marketplace) that keeps every server instance's demo data in step. Without them each instance keeps its own copy |
| `LAB_MCP_PERSONA` | Who the MCP server acts as: `rivera` (default), `jasmine`, `haddad`, or the data-layer-only `okafor`, `lee` |

### Deploy (Vercel)

No backend is needed. Set `ANTHROPIC_API_KEY`, `LAB_SIGNING_SECRET`, `LAB_DEMO_LOGIN=1` and a low `LAB_MONTHLY_SPEND_CAP_USD`, then `vercel deploy --prod`. Every server instance starts from the same sample data. With Upstash connected (`KV_REST_API_URL`, `KV_REST_API_TOKEN`), every change after that goes into one shared, append-only log that each instance replays before it reads (`src/lib/demo/sync.ts`), so a student's progress survives when Vercel routes a click to another instance. To reset the live demo, bump `SEED_VERSION` in `sync.ts` and redeploy: a new seed version starts a fresh log.

## Accounts

Open http://localhost:3000 (the simulated Year Up sign-in) and pick an account. You land on a simulated Brightspace home; the **AI Foundations** course tile opens the AI Lab. To switch accounts, sign out from the avatar menu. Sign-in is a signed demo cookie; no passwords exist.

| Account | Role | What they see |
| --- | --- | --- |
| Jasmine Carter | Student, IT support, Section B | Starts fresh: starting point check, then Modules 1 to 3, final check, skills page |
| Ms. Rivera | Instructor, Sections B and C | Instructor console: who needs help today, most-missed check, starting point to final lift |

Curriculum (Dev Okafor) and admin (Sam Lee) accounts exist only in the data layer, so the four-role access rules stay tested (`tests/rls.test.ts`, the MCP server). They have no screens in this demo.

## The course

`src/lib/curriculum/course.ts` is the syllabus: **Starting point check** (4 short coached tasks, one per fluency skill, not graded) -> **Module 1, Writing prompts** -> **Module 2, Comparing models** -> **Module 3, Building a bot** -> **Final check** (a parallel form of the starting point: same checks, new scenarios) -> **Your skills**. Each module is a 5-minute lesson that opens with an annotated worked example (`src/lib/curriculum/lessons.ts`), then three practice tasks. A practice task is done when one attempt passes 80% of its checks.

## Reset the sample data

Restart the server. The sample data is generated fresh (and identically) on every start: 3 sections of 40 invented students, about 2,000 practice attempts plus starting point and final checks. Jasmine has no attempts, so the demo starts from her first screen. Most improve; 3 students in Section B are stuck on Description; Section C lags on Discernment.

## Tests and evals

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e            # Playwright: the demo journey end to end
npm run eval -- --dry-run   # validate the eval datasets, estimate cost, no API calls
npm run eval                # grading + safety evals against the live coach (spends a little money)
```

- **Grading eval:** 40 hand-labeled attempts (8 held out). Reports agreement with the labels, consistency across re-runs, and agreement by group. Gate: at least 80% on the held-out set.
- **Safety eval:** 20 attempts built to break the rules (asks for the answer, off-topic, personal info, distress, prompt injection). Gate: 20 of 20.
- Results appear in `eval/reports/`; the instructor console shows the latest numbers (from `src/lib/demo/eval-snapshot.json`).
- The labels were written by the same AI that built the coach. **Have a person review them** (`eval/coach/LABELS.md`) before trusting the agreement number.
- The older lesson Q&A eval (`eval/run_eval.py`) now tests the real app through `/api/coach/ask`. See `eval/README.md`.

## MCP server (ask Claude about your class)

A read-only MCP server over the Lab's sample data. It acts as a persona, so the same access rules limit what it can see.

```bash
npm run mcp                 # stdio server; registered in .mcp.json as "ai-lab"
```

Tools: `get_class_overview(section)`, `list_students_needing_help(section, skill)`, `get_student_progress(student)`, `get_exercise_stats(exercise)`. Demo, as Ms. Rivera: *"Who in Section B is stuck on Description, and what should I reteach?"*

## How it's built

- **Coach** (`src/lib/coach/`): one prompt per studio in the PRD's order (role, lesson, rubric checks, rules, one example, then the attempt). The lesson, rubric and rules are cached. Structured output returns each check with a quote and a pass/fail, plus one tip. Code then verifies every quote really appears in the student's text; an unverified "pass" never counts and goes to the instructor for review. The word-count check is decided in code, not by the model.
- **Before any Claude call:** distress phrases skip the coach entirely and show a staff contact; the student's name is replaced with their pseudonymous ID and personal info is stripped; the daily budget and monthly cap are checked. If Claude is down, the attempt is saved and scored later.
- **Data and security:** the demo has no backend. Data lives in memory (`src/lib/demo/`) behind the same access rules as the Postgres row-level security policies in `supabase/migrations/`, which stay as the pilot's database design. App reads always go through the signed-in user's access rules; only the server writes scores; overrides, staff views and break-glass reads are audited.
- **Models:** grading and runs on `claude-haiku-5-5`; Model Arena compares Haiku, Sonnet and Opus 5.5. Prices in `src/lib/models.ts`.

## What's simulated

- Brightspace course page, LTI launch and gradebook sync
- Year Up / Azure sign-in (a signed demo cookie per persona)
- The database (in memory for the demo; the Postgres schema for the pilot is in `supabase/migrations/`)
- All students, sections, attempts and lessons (sample lessons built on `eval/corpus/`)
- Program rollups "scaled from sample" to 1,700 students
