"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/design/icons";

/**
 * The glass device on the sign-in screen: a sample coach result. It can be held and tilted with a pointer drag,
 * and springs back on release. Reduced motion: no tilt (CSS also keeps it flat).
 */
export function SignInDevice() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let sx = 0;
    let sy = 0;
    let down = false;
    const onDown = (e: PointerEvent) => {
      if (reduce.matches) return;
      down = true;
      sx = e.clientX;
      sy = e.clientY;
      d.classList.add("is-held");
      d.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
      d.style.setProperty("--ry", `${clamp(-6 + (e.clientX - sx) / 9, 16)}deg`);
      d.style.setProperty("--rx", `${clamp(2 - (e.clientY - sy) / 9, 12)}deg`);
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      d.classList.remove("is-held");
      d.style.removeProperty("--ry");
      d.style.removeProperty("--rx");
    };
    d.addEventListener("pointerdown", onDown);
    d.addEventListener("pointermove", onMove);
    d.addEventListener("pointerup", onUp);
    d.addEventListener("pointercancel", onUp);
    return () => {
      d.removeEventListener("pointerdown", onDown);
      d.removeEventListener("pointermove", onMove);
      d.removeEventListener("pointerup", onUp);
      d.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div ref={ref} className="en-device ds-glass ds-sq ds-rise" style={{ "--i": 3 } as React.CSSProperties} aria-hidden>
      <p className="en-device-cap">Example coach result</p>
      <div className="en-device-in">
        <p>You are a senior help-desk technician. Summarize this ticket for the next-shift technician.</p>
      </div>
      <p className="en-device-score">2 of 3</p>
      <div className="en-device-checks">
        <div className="ds-coach-check">
          <Icon name="check" />
          <b>Gives the AI a role</b>
          <q>You are a senior help-desk technician</q>
        </div>
        <div className="ds-coach-check">
          <Icon name="check" />
          <b>Says who it is for</b>
          <q>for the next-shift technician</q>
        </div>
        <div className="ds-coach-check" data-state="fail">
          <Icon name="minus" />
          <b>Asks for a format or length</b>
        </div>
      </div>
    </div>
  );
}
