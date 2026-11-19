"use client";

import { useEffect, useRef, useState } from "react";
import { attach, type Marker } from "./kmk";

/**
 * A switch: a real button with role="switch". Its thumb is an elastic marker between two slots (bounce 2):
 * it stretches to about 36px, overshoots and settles at 27px.
 */
export function Switch({
  checked,
  defaultChecked = false,
  onChange,
  children,
  disabled,
  className = "",
  ...rest
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (on: boolean) => void;
  /** The visible label. */
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "className" | "children">) {
  const [own, setOwn] = useState(defaultChecked);
  const on = checked ?? own;
  const track = useRef<HTMLSpanElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const marker = useRef<Marker | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const t = track.current;
    if (!t || !thumb.current) return;
    const m = attach(t, { mk: thumb.current, bounce: 2 });
    marker.current = m;
    first.current = true;
    return () => {
      m.destroy();
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    const t = track.current;
    const m = marker.current;
    if (!t || !m) return;
    const slots = t.querySelectorAll("i");
    m.to(slots[on ? 1 : 0] ?? null, !first.current);
    first.current = false;
  }, [on]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={`ds-switch ${className}`.trim()}
      onClick={() => {
        setOwn(!on);
        onChange?.(!on);
      }}
      {...rest}
    >
      <span className="ds-switch-track" ref={track}>
        <span className="kmk" ref={thumb} aria-hidden />
        <i />
        <i />
      </span>
      {children}
    </button>
  );
}
