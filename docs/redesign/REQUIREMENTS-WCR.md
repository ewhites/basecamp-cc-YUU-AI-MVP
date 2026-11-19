# Build requirements from the WCR AI SIM spec (added 2026-11-19)

Logan shared his manager's two pages, "WCR AI SIM: Overview" and "WCR AI SIM: Design" (kept on Logan's Mac, not in this repo). They add build requirements on top of the redesign. Rule from Logan: follow them, and do not change the redesign rules (DESIGN-RULES.md, BUILD-PLAN.md) unless a requirement plainly contradicts them; when it does, ask Logan first.

## No Brightspace
The product is no longer delivered through Brightspace. Students sign in with a provisioned Year Up account (simulated in this demo). No Brightspace page, launch, course tile or gradebook sync. Scores still reach students only after a facilitator releases them.

## Followed without asking (no conflict with the redesign)
- Roles in copy: student, facilitator, admin. "Instructor" becomes "facilitator" on screen (routes stay).
- Acceptable-use notice at first sign-in: one screen in the first visit, right after the welcome.
- Lessons: an optional scripted "Watch demo" that makes no model calls.
- Coach: a chat in the side window beside each lesson and task; nudges, never gives the answer; stays on the current lesson; points to what is next.
- Warn when a student types or pastes what looks like personal data.
- "How it works" page: access and history, the tool sandbox, tokens and cost (`/lab/how-it-works`, in the account menu).
- Works on laptops and tablets, keyboard navigation, accessible contrast.

## Decided by Logan on 2026-11-19 (conflicts he resolved)
1. Course home: a progress bar across the curriculum and clickable lesson rows with status are the main content. The three doors stay, smaller, above them.
2. Curriculum: five coached skills (prompting, validation, context engineering, comparing models, responsible use), each module mapped to one of the six curriculum competencies. Rerun the coach evals after the change.
3. Agent Builder: build the tool sandbox in this redesign: simulated spreadsheet, outbox, notes doc and memory panel; a human approval step; three ordered exercises (one live build, two scripted demos). Teaching points: context plus reasoning plus tools, least privilege, human in the loop.
4. Cost console: build it in this redesign: facilitators see cohort progress and override a student's daily cap (with a log); admins see spend to date, spend per student, tokens by model, cache hit rate, active students and top lessons against the budget, with alerts at 50%, 80% and 100%. Reports are totals only; no message content.

## Production items not in this demo
Real accounts and cohort roster, AWS hosting, stored chat history, monitoring. The demo stays on sample data.
