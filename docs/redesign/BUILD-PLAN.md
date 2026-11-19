# Build plan: Year Up United AI Lab redesign

Written 2026-11-19 by the planning session (Fable 5.2). The build runs on Opus 5.5, at Logan's request. Read `DESIGN-RULES.md` first, then open `vision-board.html` with Look set to "Light reading sheet" and Coach set to "Side panel". That board is the target.

## Decisions Logan made (2026-11-19, final)

1. Design source: the live kaleoshq.com design, in Year Up's colours. His words: "a derivative of my kaleoshq site design".
2. Look: **light reading sheet**. The ground, top bar, dock and coach are dark glass. Anything a person reads or writes on is the cream sheet.
3. Coach: **side panel**, always visible on lesson, practice and check screens. On a phone it sits under the work.
4. First pages: **redesign all of it**, the Brightspace page included. It keeps its "Simulated" label.
5. Nothing of the current styling is kept: buttons, layout, rails, navigation, colours, motion.
6. He does not want to recalibrate until the redesign is finished. Do not stop to ask design questions. Decide from `DESIGN-RULES.md` and note the choice in `TASKS.md`.

## What must not change

- The rules in `CLAUDE.md` under "Rules (from the PRD, do not weaken)". All of them.
- `src/lib/**` logic: coach prompts, grading, verify, privacy, distress, budget, the data layer, access rules. The redesign is presentation only. Reason: the coach's grading has an eval gate (80% agreement, 20 of 20 safety). A changed prompt needs a new eval run, which costs money and is not part of this job.
- Every `data-testid` in `src/`. The end-to-end test and the demo script use them. Move a hook with its element. Never delete one.
- "Sample data" on every screen and "Simulated" on every simulated connection, as plain small text.
- Server actions and routes: `src/app/lab/actions.ts`, `src/app/lab/instructor/actions.ts`, `src/app/api/**`, `/launch`, `/signout`, `/portfolio/[token]` behaviour.
- Tests are never weakened. A test may change only when the product behaviour it checks changed on purpose (for example the first visit), and the new test must check as much as the old one.

## New structure

```
src/design/
  tokens.css        every colour, size, radius, curve (from DESIGN-RULES.md, nothing else)
  base.css          resets, type, focus ring, reduced motion, the ground
  components.css    glass, sheet, button, field, row, progress, dock, coach, segmented, switch, checkbox
  kmk.ts            the elastic marker, ported from docs/redesign/vision/kmk.js (client only)
  Elastic.tsx       client wrapper: runs KMK.auto on a container, cleans up on unmount
  TopBar.tsx        logo tile, "AI Lab", sample note, initials menu (Brightspace, sign out)
  Dock.tsx          three places and the raised button, per role
  Sheet.tsx, Glass.tsx, Button.tsx, Progress.tsx, Segmented.tsx, Switch.tsx, Checkbox.tsx, AnswerList.tsx
  CoachPanel.tsx    the side panel: score, checks with quotes, one tip, ask box
```

- Fonts load with `next/font/google`: Fraunces (axes `SOFT` and `opsz`, weights 300 to 500) and Hanken Grotesk (400 to 700). Remove the Lato and Source Sans link from `src/app/layout.tsx`.
- Delete `src/app/globals.css` rules and `src/app/styles/*.css` as each screen moves over. At the end no old class is left. Page styles live in one CSS file per area (`entry.css`, `learn.css`, `staff.css`) that use tokens only.
- No hard-coded colour, radius or shadow in a page or component file. Add a lint check or a test that greps for hex colours outside `src/design/tokens.css`.
- Remove `@brightspace-ui/core` if nothing imports it after the Brightspace page is redone.

## The one page template

Top bar, then one progress line that says where you are, then the cream sheet (kicker, title, one-line brief, material, work surface, main button bottom right), with the coach panel to its right at 360px on screens 980px and wider. The dock floats at the bottom centre. The left syllabus rail is removed: the course home (three doors) and the progress line replace it.

| Screen | Route | Sheet holds | Coach panel |
| :-- | :-- | :-- | :-- |
| Sign in | `/` | Headline, two accounts (`.account` x2, `signin-*` hooks), the glass device | none |
| Brightspace (simulated) | `/home` | Course tile (`course-tile`), in the new look, "Simulated" | none |
| First visit | `/lab/welcome` (new) | One question a screen | none (the coach speaks as the question) |
| Course home | `/lab` | Three doors, "Up next" (`up-next`), final check and skills as rows | none |
| Lesson | `/lab/lesson/[module]` | Worked example first, then Start practice | ask box only |
| Practice | `/lab/practice/[id]` | Prompt, Arena or Agent form | latest attempt: score, checks, tip, ask box; older attempts fold under it |
| Starting and final check | `/lab/check/[kind]` | One task a screen, progress line | result after each task |
| Skills and badge | `/lab/skills` | Skill bars, the badge, share link | none |
| Instructor console | `/lab/instructor` | "Needs you" first as rows, then the lift, then reliability | none |
| Student detail | `/lab/instructor/student/[id]` | Attempts as rows, override panel | the coach's draft for the open attempt |
| Public portfolio | `/portfolio/[token]` | Badge and skills, no dock | none |

Docks. Student: Home, Learn, Skills, and the raised button "Next" (the next unfinished step). Instructor: Class, Students, Coach (the reliability view), and the raised button opens the first "needs you" row. If the instructor pages do not split cleanly into three places, use fewer. Never add a "More" item.

## First visit (new screens, small new behaviour)

- Route `/lab/welcome`. Four steps as on the board: welcome, kind of work, AI experience, find your starting point. Then it opens the starting point check or the course home.
- Store the two answers in one cookie. No change to the data layer. Use them for two things only: practice tasks of the chosen kind of work come first in a module, and the worked example opens by default for "Never" and "A few times".
- `/lab` sends a student there once: only when the cookie is missing and the student has no attempts. Deep links (`/launch?...&next=`) are never intercepted.
- Update `tests/e2e/demo.spec.ts` to walk the first visit where the flow now passes through it. Keep every other assertion.

## Motion

- Port `kmk.js` to `src/design/kmk.ts` unchanged in behaviour. Segmented controls, tabs, the dock, answer lists and switches use it with bounce 1.6 (switch 2). Checkbox uses the width-then-height fill.
- One entrance per page (10px rise, 60ms stagger, at most six items).
- Coach result: checks arrive 180ms apart, each quoted phrase highlights in the student's own text, then the tip.
- Typing caret in the write surface. The device on the sign-in screen can be held and tilted. The finished badge on the skills page can be held and spun the same way.
- Page changes: a door opening into its lesson and the progress line moving are done with the View Transitions API only if it works in Next 16 without an experimental flag. If not, use the page entrance and move on. Do not ship a flaky transition.
- Reduced motion: final states at once, everywhere.

## Phases

Phase 1 runs alone. Phases 2 to 4 touch separate files and may run as three Opus 5.5 subagents, each in its own git worktree branched from the Phase 1 commit, merged in order. One writer per file.

1. **Foundation.** `src/design/**`, fonts, `src/app/layout.tsx`, `src/app/lab/layout.tsx` (new shell, no syllabus rail), loading state. Done when a blank lab page shows the ground, top bar, sheet, coach slot and dock at 1440 and 390 wide, and lint, type check and unit tests pass.
2. **Entry.** `/`, `/home`, `/lab/welcome`, `/lab` (doors), `entry.css`.
3. **Learning.** Lesson, practice (three forms), checks, `AttemptResult`, `CheckList`, `AskCoach` inside `CoachPanel`, `learn.css`.
4. **Staff and proof.** Instructor console, student detail, skills, public portfolio, `staff.css`.
5. **Finish.** Delete old CSS and unused components, update the end-to-end test, update `CLAUDE.md` (Stack and "What it is" sections) and `docs/demo-script.md`, run every check below.

## Proof of done

Run and report each command with its result:

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e
```

Then, with the dev server running:

1. Playwright screenshots of every route in the table, at 1440x900 and 390x844. Open them and read them against the review checklist in `DESIGN-RULES.md` and the unslop checklist. Fix and shoot again.
2. axe-core (WCAG 2.2 A and AA) on every route: no violations. Text contrast 4.5:1 on the cream sheet and on glass. Nothing scrolls sideways at 320px.
3. A reduced-motion pass on the practice screen and the first visit.
4. `git grep` shows no hex colour outside `src/design/tokens.css` and no class from the old `globals.css`.
5. The coach evals are not rerun (no prompt changed). Say so in the report. If any file under `src/lib/coach/` changed, stop and explain why.

Vercel's build needs the network for the two fonts. A local `npm run build` inside the sandbox can fail on that alone: rerun it outside the sandbox before calling it a failure.

## Shipping

Work on `logan`. Commit per phase (`feat(ui): ...`). Push `logan` (it deploys a Vercel preview for project `yuu-ai-lab`), check the preview shows the new commit and loads every route, and give Logan the preview address. The project rule says: do not push or merge to `main` without asking. That is the one question at the end. The GitHub repo belongs to Ethan White (`ewhites`), so the merge to `main` is also Ethan's demo changing.
