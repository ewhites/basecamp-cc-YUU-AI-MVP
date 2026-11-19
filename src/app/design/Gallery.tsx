"use client";

import { useState } from "react";
import { AccountMenu } from "@/design/AccountMenu";
import { AnswerList } from "@/design/AnswerList";
import { Button } from "@/design/Button";
import { Checkbox } from "@/design/Checkbox";
import { CoachAsk, CoachCheck, CoachPanel } from "@/design/CoachPanel";
import { Dock, type DockPlace } from "@/design/Dock";
import Image from "next/image";
import { Ground } from "@/design/Ground";
import { Progress } from "@/design/Progress";
import { Segmented } from "@/design/Segmented";
import { Sheet } from "@/design/Sheet";
import { Switch } from "@/design/Switch";
import { TopBar } from "@/design/TopBar";

const USER = { name: "Jasmine Carter", initials: "JC", detail: "Student · IT support · Section B" };

const PLACES: DockPlace[] = [
  { label: "Home", href: "/design", icon: "home", match: ["/lab$"] },
  { label: "Learn", href: "/design", icon: "learn", match: ["/lab/practice"] },
  { label: "Skills", href: "/design", icon: "skills", match: ["/lab/skills"] },
];

const MATERIALS = [
  ["/materials/ground.webp", "ground.webp, 2560 by 1600", 2560, 1600],
  ["/materials/ground-tall.webp", "ground-tall.webp, portrait", 1200, 2400],
  ["/materials/marble.webp", "marble.webp, coach header", 1600, 1000],
  ["/materials/linen.webp", "linen.webp", 1200, 1200],
] as const;

const STATES = [
  ["Default", ""],
  ["Hover", "is-hover"],
  ["Focus", "is-focus"],
  ["Pressed", "is-pressed"],
] as const;

/** Every Phase 1 component in every state, on the real ground. */
export function Gallery() {
  const [coach, setCoach] = useState<"scored" | "waiting">("scored");
  const [tab, setTab] = useState<"lesson" | "practice" | "results">("practice");
  const [hints, setHints] = useState(false);
  const [work, setWork] = useState<string | null>("it");
  const [place, setPlace] = useState("/lab/practice");
  const [ground, setGround] = useState<"show" | "study">("show");

  return (
    <Ground strength={ground}>
      <TopBar user={USER} home="/design" />
      <main id="main" className="ds-content">
        <div className="gal ds-page">
          <section className="gal-sec ds-page">
            <Progress label="Writing prompts" value={0.5} end="Task 2 of 3" />
            <div className="ds-work">
              <Sheet
                kicker="IT support"
                title="Help-desk ticket summary"
                brief="Your shift ends in 10 minutes. Write a prompt that gets the AI to summarize this ticket for the next-shift technician."
                actions={
                  <>
                    <Button variant="quiet">See an example</Button>
                    <Button>Run prompt</Button>
                  </>
                }
              >
                <div className="ds-inset ds-sq">Ticket #48213</div>
              </Sheet>
              <CoachPanel
                score={coach === "scored" ? "3 of 4" : undefined}
                scored={coach === "scored"}
                empty={coach === "waiting" ? "Run your prompt to see what to fix" : undefined}
                tip={coach === "scored" ? "Tell the AI what shape and length you want back" : undefined}
                ask={<CoachAsk onSubmit={(e) => e.preventDefault()} />}
              >
                {coach === "scored" ? (
                  <>
                    <CoachCheck n={1} pass label="Gives the AI a role" quote="You are a senior help-desk technician" />
                    <CoachCheck n={2} pass label="Asks for one outcome" quote="Summarize this ticket" />
                    <CoachCheck n={3} pass label="Says who it is for" quote="for the next-shift technician" />
                    <CoachCheck n={4} pass={false} label="Asks for a format or length" />
                  </>
                ) : null}
              </CoachPanel>
            </div>
            <div className="gal-row gal-panel" style={{ marginTop: 16 }}>
              <Segmented
                label="Ground strength"
                value={ground}
                onChange={setGround}
                options={[
                  { value: "show", label: "Show ground" },
                  { value: "study", label: "Study ground" },
                ]}
              />
              <Segmented
                label="Coach state"
                value={coach}
                onChange={setCoach}
                options={[
                  { value: "scored", label: "Scored" },
                  { value: "waiting", label: "Waiting" },
                ]}
              />
            </div>
          </section>

          <section className="gal-sec gal-panel ds-page">
            <h2>Progress line</h2>
            <Progress label="Starting point check" value={0} end="Task 1 of 4" />
            <Progress label="Comparing models" value={1} end="Done" />
          </section>

          <Sheet as="section" className="gal-sec ds-page" titleAs="h2" title="Buttons on the sheet">
            <div className="gal-grid">
              {STATES.map(([name, cls]) => (
                <div className="gal-cell" key={name}>
                  <span>{name}</span>
                  <Button className={cls}>Run prompt</Button>
                  <Button variant="quiet" className={cls}>
                    See an example
                  </Button>
                </div>
              ))}
              <div className="gal-cell">
                <span>Disabled</span>
                <Button disabled>Run prompt</Button>
                <Button variant="quiet" disabled>
                  See an example
                </Button>
              </div>
              <div className="gal-cell">
                <span>Pressed-down (first visit)</span>
                <Button lift>Continue</Button>
                <Button lift disabled>
                  Continue
                </Button>
              </div>
            </div>
          </Sheet>

          <section className="gal-sec gal-panel ds-page">
            <h2>Buttons on the ground</h2>
            <div className="gal-grid">
              {STATES.map(([name, cls]) => (
                <div className="gal-cell" key={name}>
                  <span>{name}</span>
                  <Button variant="paper" className={cls}>
                    Sign in as Jasmine
                  </Button>
                  <Button variant="quiet" className={cls}>
                    Sign in as Ms. Rivera
                  </Button>
                </div>
              ))}
              <div className="gal-cell">
                <span>Disabled</span>
                <Button variant="paper" disabled>
                  Sign in as Jasmine
                </Button>
                <Button variant="quiet" disabled>
                  Sign in as Ms. Rivera
                </Button>
              </div>
            </div>
          </section>

          <Sheet as="section" className="gal-sec ds-page" titleAs="h2" title="Controls that stretch">
            <div className="gal-grid">
              <div className="gal-cell">
                <span>Tabs (try it)</span>
                <Segmented
                  label="Tabs"
                  value={tab}
                  onChange={setTab}
                  data-testid="gallery-seg"
                  options={[
                    { value: "lesson", label: "Lesson" },
                    { value: "practice", label: "Practice" },
                    { value: "results", label: "Results" },
                  ]}
                />
                <span>With a disabled option</span>
                <Segmented
                  label="Tabs, states"
                  defaultValue="a"
                  options={[
                    { value: "a", label: "Chosen" },
                    { value: "b", label: "Other" },
                    { value: "c", label: "Disabled", disabled: true },
                  ]}
                />
              </div>
              <div className="gal-cell">
                <span>Switch (try it)</span>
                <Switch checked={hints} onChange={setHints} data-testid="gallery-switch">
                  Show hints
                </Switch>
                <Switch defaultChecked>On</Switch>
                <Switch className="is-hover">Hover</Switch>
                <Switch disabled>Disabled</Switch>
              </div>
              <div className="gal-cell">
                <span>Checkbox (try it)</span>
                <Checkbox defaultChecked>Use only the ticket text</Checkbox>
                <Checkbox>Leave out phone numbers</Checkbox>
                <Checkbox className="is-hover">Hover</Checkbox>
                <Checkbox disabled>Disabled</Checkbox>
                <Checkbox disabled defaultChecked>
                  Disabled and ticked
                </Checkbox>
              </div>
            </div>
            <div className="gal-grid" style={{ marginTop: 32 }}>
              <div className="gal-cell" style={{ justifyItems: "stretch" }}>
                <span>Answer list (try it, arrow keys work)</span>
                <AnswerList
                  label="What kind of work are you training for"
                  value={work}
                  onChange={setWork}
                  options={[
                    { value: "it", label: "IT support" },
                    { value: "ops", label: "Business operations" },
                    { value: "dev", label: "Software development" },
                    { value: "none", label: "Not sure yet", disabled: true },
                  ]}
                />
              </div>
            </div>
          </Sheet>

          <section className="gal-sec gal-panel ds-page">
            <h2>Controls on the ground</h2>
            <div className="gal-row">
              <Segmented
                label="Look"
                defaultValue="side"
                options={[
                  { value: "side", label: "Side panel" },
                  { value: "dock", label: "Dock button" },
                  { value: "page", label: "In the page" },
                ]}
              />
              <Switch defaultChecked>Show hints</Switch>
              <Checkbox defaultChecked>Leave out phone numbers</Checkbox>
            </div>
          </section>

          <section className="gal-sec gal-panel ds-page">
            <h2>Account menu</h2>
            <p>The initials in the top bar open it. Shown open here.</p>
            <div className="gal-row gal-menu" style={{ justifyContent: "flex-end", alignItems: "flex-start" }}>
              <AccountMenu user={USER} defaultOpen />
            </div>
          </section>

          <section className="gal-sec gal-panel ds-page">
            <h2>Dock</h2>
            <p>The dock below is live. Choose a place to see the marker move.</p>
            <Segmented
              label="Dock place"
              value={place}
              onChange={setPlace}
              options={[
                { value: "/lab", label: "Home" },
                { value: "/lab/practice", label: "Learn" },
                { value: "/lab/skills", label: "Skills" },
              ]}
            />
          </section>

          <section className="gal-sec gal-panel ds-page">
            <h2>Materials</h2>
            <p>Rendered once from scripts/materials. Ground (wide and tall), marble for the coach header, and linen.</p>
            <div className="gal-grid">
              {MATERIALS.map(([src, name, w, h]) => (
                <figure className="gal-cell gal-mat" key={src}>
                  <Image src={src} alt="" width={w} height={h} sizes="(max-width: 600px) 100vw, 280px" />
                  <figcaption>{name}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          <p className="gal-foot gal-panel ds-page">Sample data. For review only, not linked from the app.</p>
        </div>
      </main>
      <Dock places={PLACES} next={{ label: "Next", href: "/design" }} current={place} />
    </Ground>
  );
}
