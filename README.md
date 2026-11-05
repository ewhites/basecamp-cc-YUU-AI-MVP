# Year Up United AI Lab (prototype)

A working demo of the AI Lab from the PRD: one place, opened from a simulated Brightspace course, where students practice prompting, model comparison and agent building with a Claude coach, and instructors see who understands what.

**Everything is sample data.** Every screen says "Sample data". The Brightspace launch, Year Up sign-in and gradebook sync are simulated and labeled "Simulated".

## Run it

You need Node 20+, Docker Desktop running, and an Anthropic API key.

```bash
npm install
npx supabase start          # local Postgres + auth in Docker (first run downloads images)
npm run db:reset            # creates the schema and the sample data
```

Put your API key in `.env.local` (never committed; a git hook blocks it). This prompts for it without echoing:

```bash
read -s "k?Anthropic API key: " && printf 'ANTHROPIC_API_KEY=%s\n' "$k" > .env.local && unset k
```

Then:

```bash
npm run dev                 # open http://localhost:3000
```

Set a monthly spend limit on the key in the Anthropic Console. The app also has its own guards (see "Spend guards").

### Environment variables

All optional except the API key. The Supabase values are read from `npx supabase status` automatically when not set.

| Name | What it is |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key (required for coaching and evals) |
| `LAB_DAILY_TOKEN_BUDGET_PER_STUDENT` | Daily token budget per student (default 60,000) |
| `LAB_MONTHLY_SPEND_CAP_USD` | Lab-wide monthly spend cap (default $50) |
| `LAB_MCP_PERSONA` | Who the MCP server signs in as: `rivera`, `jasmine`, `okafor`, `lee` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Override the local Supabase connection |

## Accounts

Open http://localhost:3000 (the simulated "AI Foundations" course page) and click **Open AI Lab** next to a persona. The role switcher at the top right of every Lab page changes accounts. Sign-in uses one-time tokens; no passwords exist.

| Account | Role | Lands on |
| --- | --- | --- |
| Jasmine Carter | Student, IT support, Section B | Student home |
| Ms. Rivera | Instructor, Sections B and C | Instructor console |
| Dev Okafor | Curriculum designer | Curriculum insights |
| Sam Lee | Admin (Solutions team) | Admin and security center |

## Reset the sample data

```bash
npm run db:reset            # drop everything, re-apply migrations, reseed (deterministic)
npm run seed                # reseed only, keeping the schema
```

The seed: 3 sections × 40 invented students, about 2,000 attempts. Most improve; 3 students in Section B are stuck on Description; Section C lags on Discernment.

## Tests and evals

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e            # Playwright: the demo journey end to end
npm run eval -- --dry-run   # validate the eval datasets, estimate cost, no API calls
npm run eval                # grading + safety evals against the live coach (spends a little money)
```

- **Grading eval:** 40 hand-labeled attempts (8 held out). Reports agreement with the labels, consistency across re-runs, and agreement by group. Gate: at least 80% on the held-out set.
- **Safety eval:** 20 attempts built to break the rules (asks for the answer, off-topic, personal info, distress, prompt injection). Gate: 20 of 20.
- Results appear in the admin center and in `eval/reports/`.
- The labels were written by the same AI that built the coach. **Have a person review them** (`eval/coach/LABELS.md`) before trusting the agreement number.
- The older lesson Q&A eval (`eval/run_eval.py`) now tests the real app through `/api/coach/ask`. See `eval/README.md`.

## MCP server (ask Claude about your class)

A read-only MCP server over the Lab's data. It signs in as a persona, so row-level security limits what it can see.

```bash
npm run mcp                 # stdio server; registered in .mcp.json as "ai-lab"
```

Tools: `get_class_overview(section)`, `list_students_needing_help(section, skill)`, `get_student_progress(student)`, `get_exercise_stats(exercise)`. Demo, as Ms. Rivera: *"Who in Section B is stuck on Description, and what should I reteach?"*

## How it's built

- **Coach** (`src/lib/coach/`): one prompt per studio in the PRD's order (role, lesson, rubric checks, rules, one example, then the attempt). The lesson, rubric and rules are cached. Structured output returns each check with a quote and a pass/fail, plus one tip. Code then verifies every quote really appears in the student's text; an unverified "pass" never counts and goes to the instructor for review. The word-count check is decided in code, not by the model.
- **Before any Claude call:** distress phrases skip the coach entirely and show a staff contact; the student's name is replaced with their pseudonymous ID and personal info is stripped; the daily budget and monthly cap are checked. If Claude is down, the attempt is saved and scored later.
- **Security:** Postgres row-level security enforces the four roles. App reads always use the signed-in user's session. Only the server writes scores (students can't grade themselves). Instructor overrides, staff views of student work and admin break-glass reads are audited. `/lab/security-check` shows the blocks live.
- **Models:** grading and runs on `claude-haiku-5-5`; Model Arena compares Haiku, Sonnet and Opus 5.5. Prices in `src/lib/models.ts`.

## What's simulated

- Brightspace course page, LTI launch and gradebook sync
- Year Up / Azure sign-in (one-time tokens for seeded personas)
- All students, sections, attempts and lessons (sample lessons built on `eval/corpus/`)
- Program rollups "scaled from sample" to 1,700 students
