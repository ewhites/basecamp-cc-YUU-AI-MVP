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
Status 2026-11-19: partly built (commit e6cb13d). Type check, lint and unit tests pass. Build, screenshots, ground wiring, show and study grounds, dock dimming still open. See docs/redesign/HANDOFF.md.
- [ ] `src/design/tokens.css`, `base.css`, `components.css`
- [ ] Fonts with `next/font` (Fraunces, Hanken Grotesk)
- [ ] `kmk.ts` and `Elastic.tsx` (the elastic marker)
- [ ] `TopBar`, `Dock`, `Sheet`, `Glass`, `Button`, `Progress`, `Segmented`, `Switch`, `Checkbox`, `AnswerList`, `CoachPanel`
- [ ] New lab shell in `src/app/lab/layout.tsx` (no syllabus rail), loading state
- [ ] Lint, type check and unit tests pass

## Phase 2: entry
- [ ] Sign in (`/`)
- [ ] Brightspace page, simulated (`/home`)
- [ ] First visit (`/lab/welcome`), cookie, one-time redirect from `/lab`
- [ ] Course home with three doors (`/lab`)

## Phase 3: learning
- [ ] Lesson (`/lab/lesson/[module]`)
- [ ] Practice: prompt, arena and agent forms (`/lab/practice/[id]`)
- [ ] Starting and final check (`/lab/check/[kind]`)
- [ ] Coach side panel: score, checks with quotes, one tip, ask box

## Phase 4: staff and proof
- [ ] Instructor console (`/lab/instructor`)
- [ ] Student detail (`/lab/instructor/student/[id]`)
- [ ] Skills and badge (`/lab/skills`)
- [ ] Public portfolio (`/portfolio/[token]`)

## Phase 5: finish
- [ ] Old CSS and unused components deleted, `@brightspace-ui/core` removed if unused
- [ ] End-to-end test updated for the first visit, nothing weakened
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` pass
- [ ] `npm run test:e2e` passes
- [ ] Screenshots of every route at 1440x900 and 390x844, read against the checklists
- [ ] axe-core clean, contrast checked, no sideways scroll at 320px, reduced motion checked
- [ ] No hex colour outside `src/design/tokens.css`
- [ ] `CLAUDE.md` and `docs/demo-script.md` updated
- [ ] `logan` pushed, Vercel preview checked, address sent to Logan

## Blocked on Logan
- [ ] Merge to `main` (project rule: ask first). Ask once, after the preview is checked.

## Choices made during the build
(Add one line per design choice made without asking, with the rule it came from.)
