"use client";

import { usePathname } from "next/navigation";
import { BrightspaceChrome } from "./BrightspaceChrome";

/** Client wrapper so the minibar can highlight the current Lab page. */
export function LabNav(props: { links: { href: string; label: string }[]; user: { name: string; role: string } }) {
  const path = usePathname();
  const active = [...props.links].sort((a, b) => b.href.length - a.href.length).find((l) => path === l.href || path.startsWith(l.href + "/"))?.href;
  return <BrightspaceChrome links={[{ href: "/", label: "Course Home" }, ...props.links]} active={active} user={props.user} />;
}
