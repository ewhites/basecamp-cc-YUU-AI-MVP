"use client";

import { usePathname } from "next/navigation";
import { Elastic } from "./Elastic";

export type GroundStrength = "show" | "study";

/** Screens that show the full linen and ribbons. Every other lab screen is a study screen. */
const SHOW = ["/lab$", "/lab/welcome", "/lab/skills", "/lab/portfolio"];

export function groundFor(path: string): GroundStrength {
  return SHOW.some((m) => (m.endsWith("$") ? path === m.slice(0, -1) : path === m || path.startsWith(m + "/"))) ? "show" : "study";
}

/**
 * The page ground and shell. Runs the elastic marker for everything inside it.
 * strength: "show" (full ribbons) or "study" (calmed). If not given, it follows the path (lab layout).
 */
export function Ground({ strength, children }: { strength?: GroundStrength; children: React.ReactNode }) {
  const path = usePathname() ?? "";
  return (
    <Elastic className="ds-ground ds-shell" data-ground={strength ?? groundFor(path)}>
      {children}
    </Elastic>
  );
}
