# TASKS: redesign in the Kaleos HQ look (branch `logan`, started 2026-11-19)

Plan: `docs/redesign/BUILD-PLAN.md`. Rules: `docs/redesign/DESIGN-RULES.md`. Target: `docs/redesign/vision-board.html` (Look: Light reading sheet, Coach: Side panel).

Logan's picks, 2026-11-19: Kaleos HQ design in Year Up colours, light reading sheet, coach as a side panel, every screen redesigned (Brightspace page too). He does not want to recalibrate until the redesign is finished. The build runs on Opus 5.5.

## Done
- [x] Vision board 1 and 2, with his picks
- [x] Design rules (unslop audit, research, Kaleos type sizes, elastic marker)
- [x] Build plan
- [x] Materials: blue linen and orange marble (`public/materials/`)
- [x] Handoff to the Year Up enterprise account (`docs/redesign/HANDOFF.md`)

## Phase 1: foundation
Status 2026-11-19: done. Build, lint, type check and 51 unit tests pass. Screenshots of /design and /lab at 1440x900 and 390x844 checked against the board (scripts/shots.mjs).
- [x] `src/design/tokens.css`, `base.css`, `components.css`
- [x] Fonts with `next/font` (Fraunces, Hanken Grotesk)
- [x] `kmk.ts` and `Elastic.tsx` (the elastic marker)
- [x] `TopBar`, `Dock`, `Sheet`, `Glass`, `Button`, `Progress`, `Segmented`, `Switch`, `Checkbox`, `AnswerList`, `CoachPanel`
- [x] New lab shell in `src/app/lab/layout.tsx` (no syllabus rail), loading state
- [x] Lint, type check and unit tests pass

## Added 2026-11-19: WCR AI SIM requirements (docs/redesign/REQUIREMENTS-WCR.md)
- [x] Five coached skills in the curriculum, check tasks per skill, sample story "stuck on Prompting"
- [x] Account menu: How it works instead of Brightspace; How it works page
- [x] No Brightspace anywhere (sign-in goes straight to the lab; /home redirects)
- [x] Acceptable-use notice in the first visit
- [x] Watch demo on lessons, coach chat thread, personal-data warning
- [x] Course home: progress bar and lesson rows, doors above
- [x] Facilitator naming everywhere, gradebook sync removed, release kept
- [x] Agent Builder tool sandbox (1 live build, 2 scripted demos)
- [x] Cost console (facilitator cap overrides with log, admin spend view, budget alerts)
- [ ] Coach evals rerun after the curriculum change (blocked: the Anthropic key in .env.local is rejected, 401)

## Phase 2: entry
- [x] Sign in (`/`)
- [x] Brightspace page, simulated (`/home`)
- [x] First visit (`/lab/welcome`), cookie, one-time redirect from `/lab`
- [x] Course home with three doors (`/lab`)

## Phase 3: learning
- [x] Lesson (`/lab/lesson/[module]`)
- [x] Practice: prompt, arena and agent forms (`/lab/practice/[id]`)
- [x] Starting and final check (`/lab/check/[kind]`)
- [x] Coach side panel: score, checks with quotes, one tip, ask box

## Phase 4: staff and proof
- [x] Instructor console (`/lab/instructor`)
- [x] Student detail (`/lab/instructor/student/[id]`)
- [x] Skills and badge (`/lab/skills`)
- [x] Public portfolio (`/portfolio/[token]`)

## Added 2026-11-19: clarity pass (Logan's review: hierarchy and what is clickable)
- [x] Structure pieces and rules 32 to 40 (Section, Panel, RowLink, Fold, Crumbs, one heading scale, blue = clickable)
- [x] Entry screens
- [x] Staff screens
- [x] Learning screens

## Phase 5: finish
- [x] Old CSS and unused components deleted, `@brightspace-ui/core` removed
- [x] End-to-end test updated for the first visit, nothing weakened
- [x] `npm run lint && npm run typecheck && npm test && npm run build` pass
- [x] `npm run test:e2e` passes (9 of 9; the 2 live-Claude tests need a working key)
- [x] Screenshots of every route at 1440x900 and 390x844, read against the checklists
- [x] axe-core clean, contrast checked, no sideways scroll at 320px, reduced motion checked
- [x] No hex colour outside `src/design/tokens.css` (tests/design-tokens.test.ts)
- [x] `CLAUDE.md` and `docs/demo-script.md` updated
- [ ] `logan` pushed (blocked: the safety check refused a push to Ethan's repo; Logan pushes)
- [x] Vercel preview deployed from this folder and checked: https://yuu-ai-p5al1kjkk-logan-kays-projects.vercel.app

## Blocked on Logan
- [ ] Merge to `main` (project rule: ask first). Ask once, after the preview is checked.

## Choices made during the build
(Add one line per design choice made without asking, with the rule it came from.)
- Area stylesheets live in src/design/areas/ (not src/app/styles/, which holds the old CSS until Phase 5). Rule: one CSS file per area, tokens only.
- Status of an attempt is plain text with one icon, not a coloured tag (rule 11, no badges).
