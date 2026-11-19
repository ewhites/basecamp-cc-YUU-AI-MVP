"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";

export interface AccountUser {
  name: string;
  initials: string;
  /** Role and section, for example "Student · IT support · Section B". */
  detail: string;
}

/** The initials button and its one menu. Closes on Escape, on a click outside and after choosing a link. */
export function AccountMenu({ user, defaultOpen = false }: { user: AccountUser; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ds-account" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className="ds-initials ds-sq"
        aria-label={`${user.initials}, account menu for ${user.name}`}
        aria-expanded={open}
        aria-controls={id}
        data-testid="account-menu"
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden>{user.initials}</span>
      </button>
      <div className="ds-menu ds-sq" id={id} hidden={!open}>
        <div className="ds-menu-who">
          <b>{user.name}</b>
          <span>{user.detail}</span>
        </div>
        <Link href="/lab/how-it-works" onClick={() => setOpen(false)}>
          <Icon name="open" />
          How it works
        </Link>
        <a href="/signout">
          <Icon name="out" />
          Sign out
        </a>
      </div>
    </div>
  );
}
