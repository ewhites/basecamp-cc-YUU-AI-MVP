# Design rules: Year Up United AI Lab redesign

Written 2026-11-19 for the redesign Logan asked for that day. The build follows this file. See it rendered in `docs/redesign/vision-board.html` (source in `docs/redesign/vision/`).

Logan's request in his words: "a derivative of my kaleoshq site design", different only in what the site does and in Year Up's colours; "a more sleek glassy look with slightly matted and gradient blue and oranges that seep through the background ever so slightly"; no "verbose or overwhelming copy, no useless logos, bubbles, pills, underlines, dots"; "great visual hierarchy, standardized layout for an easy order of operations, de cluttered nav bar with non important components folded in"; "add some stretch and bounce" to switches, checkboxes and tabs; "for onboarding copy duolingo"; "use the exact font and sizing of font that the kaleos site used".

## Where each rule comes from

| Source | What we take from it |
| :-- | :-- |
| kaleoshq.com (`kaleos-site/docs/rebrand/canopy/index.html` on `main`) | Layout protocol, fonts and sizes, radii, easing curve, the dock, the elastic marker |
| Year Up United banner | Indigo `#170055`, blue `#007EF2`, orange `#FE6500` |
| unslop by Damir Sokolovsky (github.com/heydamir/unslop, CC BY 4.0) | The audit list and the nine passes: spacing, colour, icons, copy, type, layout, details, visuals, motion |
| Research of 2026-11-19 (sources at the end) | Copy, hierarchy, navigation, glass and onboarding rules |

Unslop is a design review method, not a set of components. "Apply all of Damir's components" is done by running its audit and its passes on every screen.

## Direction (unslop's five lines)

- **Product.** Year Up students practice three AI skills on real work tasks, and a coach shows them exactly what to fix.
- **Character.** Calm, exact, encouraging.
- **World.** A workplace at night with one desk lamp on: navy dark, one warm light.
- **Moments.** The coach's answer (the one warm element on a screen), and the three doors on the course home.
- **Signature.** The lamp. A light comes on when a module is finished. Used on the doors and nowhere else.

## Tokens

**Colour.** One neutral ramp tinted to navy. Blue and orange never fill a surface: they sit in the background and show through.

| Role | Value |
| :-- | :-- |
| Page | `#05070F` |
| Ground of a screen | `#080B1C`, with soft fields of blue (24%), deep blue and orange (15%) and a fine grain |
| Glass | white at 4.5% to 8.5%, 1px hairline (text colour at 10%), top highlight, blur 28px, saturation 1.2, solid fallback `#141933` |
| Raised step, inside glass | white at 5% and 9% (no glass inside glass) |
| Text | primary `#F2F4FA`, secondary `#B6BED6`, muted `#8C95B2` (fine print only) |
| Accent | orange `#F46A12` (matte), hover `#FE6500`, text on it `#1A0B3D` |
| Evidence highlight | blue `#007EF2` at 34% behind the student's quoted words |
| Light sheet (if chosen) | Kaleos cream `#F2ECE1` and linen `#FAF6EF`, ink `#170055` |

Orange is used for three things only: the one main button on a screen, the coach, and progress. A missing check uses the light orange `#FFB27A` with a minus icon and its label, so it never relies on colour alone.

**Type.** The Kaleos HQ fonts and sizes, unchanged. Fraunces weight 300, `font-variation-settings: "SOFT" 100`, optical size automatic, letter spacing -0.022em. Hanken Grotesk for everything else.

| Use | Size |
| :-- | :-- |
| Sign-in headline | `clamp(38px, 4.25vw, 61px)`, line height 1.05 |
| Section heading | `clamp(34px, 4vw, 56px)`, line height 1.06 |
| Page title in the app | 32px, weight 400, -0.02em, line height 1.08 |
| Card and door titles | 27px, weight 400, -0.018em |
| Coach heading, dialog titles | 26px, weight 350, -0.018em |
| Line above a headline | `clamp(20px, 1.75vw, 25px)`, weight 350 |
| Lead paragraph | 20px, line height 1.5 |
| Body | 17px, line height 1.55 |
| Secondary text | 15.5px, line height 1.42 |
| Fine print | 13px |
| Buttons and quiet links | 600 16px |
| Dock labels | 600 11.5px, letter spacing 0.01em |

A screen uses at most two large sizes. Every word in a line looks the same: no italic, coloured, bold or resized word inside a sentence. Numbers that are compared use tabular figures.

**Shape and space.** 4px grid. Buttons and inputs 12px radius and 52px tall. Rows 56px. Cards 22px. Panels 28px. Inner radius equals outer radius minus the padding. `corner-shape: squircle` where the browser supports it. The dock is the Kaleos dock: 72px items, 24px icons at 1.5 stroke, 30px radius, a 56px raised button.

**Motion.** One curve, `cubic-bezier(.2,.7,.2,1)`. Hover and press 160 to 200ms, press scale 0.97. One entrance per page: a 10px rise with a 60ms stagger. Nothing loops except the typing caret. Reduced motion shows the final state at once.

## Rules

**Copy**
1. A line stays only if it stops a mistake. Delete any sentence that says what the layout already shows.
2. Buttons are a verb and its object ("Run prompt"). One word for one step: always "Continue", never a mix with "Next".
3. No exclamation marks, no greeting headlines beyond the first visit, no hype words. Labels, buttons and headings end without a period.
4. Hints are one short line. Help that only some people need opens on request.
5. "Sample data" and "Simulated" stay on every screen, as plain small text. The project rule requires them.

**Hierarchy and layout**
6. Every screen has one job, one title, one main button and at most one warm element.
7. One template, same order every time: top bar (logo, product name, sample note, initials), where you are (one progress line), the task, your work, the main button at the bottom right of the work surface.
8. Space separates groups first. A border or a box is added only when space is not enough.
9. Reading text is capped at about 36em (50 to 75 characters a line).
10. No grids of identical cards. Student lists for instructors are rows, not cards.

**Nothing decorative**
11. No pills, badges, status dots, underlines, icon tiles, sparkle icons, emoji, gradient text, coloured glows or coloured shadows.
12. One logo per screen: the Year Up United logo on its cream tile, top left, unaltered.
13. Icons come from one line set, one stroke, the colour of their text. An icon that adds nothing is removed.

**Navigation**
14. The dock holds three places (Home, Learn, Skills) and one raised button for the next step. Top-level places stay visible, because hidden navigation is slower to use.
15. Account, Brightspace and sign out sit in one menu under the student's initials. Nothing else is folded away.
16. Instructors get the same dock with their own three places.

**Glass**
17. At most three glass surfaces on a screen: the sheet, the coach and the dock. Surfaces inside them are solid steps.
18. Text never sits on a busy background. The fields behind the glass are smooth and matte.

**Controls that stretch**
19. Tabs, segmented controls, the dock, answer cards and switches use the elastic marker from kaleoshq.com (`src` copy of `docs/redesign/vision/kmk.js`). The selected shape slides, gets truly longer (its width changes, never a sideways scale, so corners stay round) and settles with one small overshoot.
20. Bounce is set to 1.6 on controls and 2 on the switch. Measured on the board: the switch thumb goes from 27px to 36.5px wide, overshoots 3px and settles at 27px.
21. A checkbox fills by growing wider, then taller, then settling. Its tick draws after.

**First visit (the Duolingo pattern, not its art or words)**
22. One question a screen, large answer rows, a progress bar at the top, one full-width "Continue" that stays off until an answer is chosen, and a button with a 4px lower edge that presses down.
23. Screens: (1) welcome that says how long it takes, (2) what kind of work, (3) how much AI experience, (4) find your starting point, (5) the starting point check, one task a screen, (6) results and the first door. A weekly plan may come after the results, never before.
24. Ask only what changes what the student sees. Sign-in and name come from Brightspace.
25. Say "check", never "test". Nothing in the first visit is graded, and the screen says so.
26. No streak guilt, no leaderboards, no reminders before the results screen.

## Materials (added 2026-11-19, later the same day)

Logan's words: "I kind of love this type of look for blue [woven blue linen] and this type of look for the orange [flowing orange marble and silk] intertwined in both the background and main component of the site", then "it should still have that modern sleek pristine and techy aesthetic", then "it should still have a clean look thats not overwhelming tho, as it is still a learning platform".

- The ground is blue linen with two twisting orange marble ribbons, rendered once by a shader (`scripts/materials/`) into `public/materials/*.webp`. No photos are used. This replaces the dark navy ground in the token table above.
- Glass panels (top bar, coach, dock) are tinted deep navy and blur the ribbons behind them. That is the "intertwined" effect.
- The coach header and the lit door carry the orange marble. Buttons stay flat matte orange. The cream sheet has no texture.
- Two ground strengths. **Show** (full ribbons): sign in, Brightspace, first visit, course home, skills, public portfolio. **Study** (ribbons calmed under a navy wash to a faint glow at the bottom): lesson, practice, checks, instructor views.
- Text never sits on a bare ribbon. Text on the bare ground sits on its calm area, or on glass.

## Learning first

27. One task on screen at a time. On a study screen the sheet is the only bright surface.
28. Reading text is at most about 36em wide, 17px, line height 1.55. Nothing runs longer than four lines without a break or a heading.
29. The order never changes: where you are, what to do, the material, your work, the one button.
30. On study screens motion is feedback only. No ambient motion and nothing that loops.
31. While a student types, the dock dims and nothing moves.

## Structure and clickability (added 2026-11-19, Logan's review)

Logan's words: the visual hierarchy is confusing because "the headings of things and their encapsulated sections and subheadings and sections all morph together"; copy "too verbose in areas, too many underlines, not enough info is folded into sections"; and "when a section is something you should click into or a button in general is clickable, you need to make it obvious", using navigation standards. These rules override any older rule above that conflicts.

32. Three heading levels, never mixed up: page title (h1, serif 32), section (h2, serif 24), sub-heading (h3, sans 17 bold). A sub-heading is never serif. Card-style titles (doors) are the only other size.
33. A section is a heading with its content boxed under it (`Section` and `Panel` in `src/design/Structure.tsx`). Space separates sections; lines do not. Hairlines appear only between rows inside one panel.
34. Blue means clickable. Links and clickable rows use `--link` (Year Up blue, darkened for contrast). Plain text is never blue, and clickable text is never indigo.
35. A row that opens something is a `RowLink`: the whole row is the link, the title is blue, and a chevron sits at the end. A row that opens nothing has no chevron and no blue.
36. Buttons look like buttons: the one main action is orange (`primary`); every other button is outlined (`secondary`). The quiet text-and-arrow style is only for navigation ("Back to Section B").
37. Secondary detail is folded (`Fold`): how something is measured, long lists, extra examples, older attempts. The fold label is blue with a chevron that turns. A page shows its main task and main facts open; everything else is one click away.
38. Every page below the top level shows breadcrumbs (`Crumbs`) above the sheet: Home / Module 1 / Help-desk ticket summary. The dock marks where you are.
39. Underlines only on links inside a sentence. No decorative underlines, and no line under every row of a page.
40. Copy: one line under a heading at most, and only when it stops a mistake. Explanations go into a fold.

Reference page: `src/app/lab/how-it-works/page.tsx`.

## Where Logan's request overrides a source

Stated once, then followed.

| Source rule | What we do | Why |
| :-- | :-- | :-- |
| Unslop: do not swap in glass or grain; no colour washes behind content | Glass sheets and soft colour fields | Logan asked for the glassy look by name. Kept quiet: neutral surfaces, low opacity, no glow |
| Unslop: no bouncy springs, never animate width | The elastic marker changes width and overshoots once | Logan asked for stretch and bounce, and his own site already does it this way |
| Apple: glass only on the control layer, content stays solid | The reading sheet is frosted | Same request. Work surfaces inside it are solid for contrast |
| Apple: a dock is for places, not actions | The dock keeps a raised action button | It is the Kaleos dock's signature |

## Decisions still open

1. Look: dark glass everywhere, or a light reading sheet for lessons.
2. Coach: side panel, dock button, or in the page.

## Research sources

- Apple Human Interface Guidelines: Writing, Materials, Color, Tab bars (developer.apple.com/design/human-interface-guidelines)
- Nielsen Norman Group: concise writing, visual hierarchy, consistency, hamburger menus, progressive disclosure, cards, Liquid Glass review (nngroup.com/articles)
- Vercel Web Interface Guidelines (vercel.com/design/guidelines)
- Linear design posts of 2024-03-28 and 2026-03-12 (linear.app/blog)
- Josh Comeau: frosted glass, the `linear()` timing function, the pressed-down button (joshwcomeau.com)
- Emil Kowalski: animation tips (emilkowal.ski)
- GOV.UK and DWP design systems: hint text and help text
- Baymard Institute: line length
- Duolingo blog posts on placement wording (2021-02-02), streaks (2020, 2022) and the growth model (2023), plus Lenny's Newsletter (2023-02-28)

Not confirmed by any source: published values for tint, grain or saturation on glass, and a named designer's write-up of the width rule for switch thumbs. Those two are our own choices, tested on the board.

Unslop is by Damir Sokolovsky (@heydamir), licensed CC BY 4.0. Keep this credit in any copy of these rules.
