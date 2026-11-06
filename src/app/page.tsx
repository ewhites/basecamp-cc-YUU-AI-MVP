import Image from "next/image";
import { redirect } from "next/navigation";
import { SampleTag, SimulatedTag } from "@/components/Tags";
import { PERSONAS } from "@/lib/personas";
import { sessionPersona } from "@/lib/db";
import { demoLoginEnabled } from "@/lib/demo/secret";

/** SIMULATED Year Up sign-in for Brightspace. In the pilot this is Year Up's single sign-on. */
export default async function SignIn() {
  if (await sessionPersona()) redirect("/home");
  const enabled = demoLoginEnabled();
  return (
    <main className="signin">
      <div className="signin-card">
        <div className="bs-logo" style={{ marginBottom: 28 }}>
          <Image src="/year-up-united.png" alt="Year Up United" className="bs-logo-img" width={109} height={36} priority />
          <span className="bar-v" />
          <span style={{ color: "#494c4e" }}>Brightspace</span>
        </div>
        <h1 style={{ fontFamily: "inherit", fontSize: 24, fontWeight: 400, margin: "0 0 6px" }}>Sign in</h1>
        <p style={{ color: "#6e7477", margin: "0 0 22px", fontSize: 15 }}>Choose an account to continue to Brightspace.</p>
        {enabled ? (
          PERSONAS.map((p) => (
            <a key={p.key} href={`/launch?as=${p.key}`} className="account" data-testid={`signin-${p.key}`}>
              <span className="bs-avatar" style={{ borderRadius: "50%", background: p.role === "student" ? "#8a1f53" : "#1d5f8f" }} aria-hidden>
                {p.initials}
              </span>
              <span>
                <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{p.name}</span>
                <span style={{ display: "block", fontSize: 14, color: "#6e7477" }}>{p.description}</span>
              </span>
              <span aria-hidden style={{ color: "#006fbf", fontSize: 20 }}>›</span>
            </a>
          ))
        ) : (
          <p className="notice notice-warn">Demo sign-in is turned off on this server.</p>
        )}
        <div className="row" style={{ marginTop: 24, gap: 8 }}>
          <SimulatedTag what="Year Up sign-in" />
          <SampleTag />
        </div>
      </div>
    </main>
  );
}
