import Image from "next/image";
import { redirect } from "next/navigation";
import { SampleTag, SimulatedTag } from "@/components/Tags";
import { buttonClass } from "@/design/Button";
import { Ground } from "@/design/Ground";
import { Icon } from "@/design/icons";
import { Panel, Section } from "@/design/Structure";
import { PERSONAS } from "@/lib/personas";
import { sessionPersona } from "@/lib/db";
import { demoLoginEnabled } from "@/lib/demo/secret";
import { SignInDevice } from "./SignInDevice";

/** SIMULATED Year Up sign-in. In the pilot this is Year Up's single sign-on. */
export default async function SignIn() {
  if (await sessionPersona()) redirect("/home");
  const enabled = demoLoginEnabled();
  return (
    <Ground strength="show">
      <div className="en-wrap">
        <header className="en-bar">
          <span className="ds-brand">
            <span className="ds-logo ds-sq">
              <Image src="/year-up-united.png" alt="Year Up United" width={85} height={28} priority />
            </span>
            <span className="ds-name">AI Lab</span>
          </span>
          <span className="en-gap" />
          <SampleTag />
        </header>
        <main id="main" className="en-hero">
          <div className="en-hero-grid">
            <div>
              <p className="en-firm ds-rise">AI Foundations</p>
              <h1 className="en-display ds-rise" style={{ "--i": 1 } as React.CSSProperties}>
                Practice real work with an AI coach
              </h1>
              <p className="en-lede ds-rise" style={{ "--i": 1 } as React.CSSProperties}>
                Write it yourself. See exactly what to fix.
              </p>
              <Section
                className="ds-rise en-signin"
                style={{ "--i": 2 } as React.CSSProperties}
                id="signin-with"
                title="Sign in"
                aside={<SimulatedTag what="Year Up sign-in" />}
              >
                {enabled ? (
                  <Panel className="en-accounts">
                    {PERSONAS.map((p) => {
                      const student = p.role === "student";
                      return (
                        <a
                          key={p.key}
                          href={`/launch?as=${p.key}`}
                          className={`${buttonClass({ variant: student ? "primary" : "secondary", block: true })} en-account account`}
                          data-testid={`signin-${p.key}`}
                        >
                          <span className="en-account-text">
                            <span className="en-account-name">
                              <span className="ds-sr">Sign in as </span>
                              {p.name}
                            </span>
                            <span className="en-account-role">{p.description}</span>
                          </span>
                          <Icon name="chev" />
                        </a>
                      );
                    })}
                  </Panel>
                ) : (
                  <Panel>
                    <p className="en-off">Demo sign-in is turned off on this server</p>
                  </Panel>
                )}
              </Section>
            </div>
            <SignInDevice />
          </div>
        </main>
      </div>
    </Ground>
  );
}
