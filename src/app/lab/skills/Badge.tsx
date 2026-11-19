"use client";

import { useEffect, useRef } from "react";

/**
 * The AI Skills badge. Once earned it can be held and spun: a pointer drag turns it in 3D,
 * and on release it springs back to face front. Reduced motion: it stays still.
 * Not earned: a quiet outline with no motion.
 */
export function Badge({ earned, count }: { earned: boolean; count: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !earned) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let rx = 0, ry = 0, vx = 0, vy = 0;
    let dragging = false, lastX = 0, lastY = 0, raf = 0;
    const paint = () => {
      el.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    };
    // A spring back to 0 with one small overshoot (stiffness and damping tuned by eye to the elastic marker).
    const settle = () => {
      cancelAnimationFrame(raf);
      const step = () => {
        vx = (vx - rx * 0.045) * 0.86;
        vy = (vy - ry * 0.045) * 0.86;
        rx += vx;
        ry += vy;
        paint();
        if (Math.abs(rx) + Math.abs(ry) + Math.abs(vx) + Math.abs(vy) > 0.05) raf = requestAnimationFrame(step);
        else {
          rx = ry = vx = vy = 0;
          paint();
        }
      };
      raf = requestAnimationFrame(step);
    };
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      cancelAnimationFrame(raf);
      el.setPointerCapture(e.pointerId);
      el.dataset.held = "yes";
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      vy = dx * 0.6;
      vx = -dy * 0.6;
      ry += vy;
      rx = Math.max(-40, Math.min(40, rx + vx));
      paint();
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      delete el.dataset.held;
      // Spin through to the nearest front face, then spring.
      ry = ((ry % 360) + 540) % 360 - 180;
      settle();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [earned]);

  return (
    <div className="st-badge-stage" data-earned={earned ? "yes" : "no"}>
      <div ref={ref} className="st-badge" role="img" aria-label={earned ? "AI Skills badge, earned" : "AI Skills badge, not earned yet"}>
        <div className="st-badge-face" aria-hidden>
          <span className="st-badge-top">Year Up United</span>
          <span className="st-badge-name">AI Skills</span>
          <span className="st-badge-sub">{count} skills</span>
        </div>
      </div>
      {earned && <p className="st-fine st-badge-hint">Drag to turn it</p>}
    </div>
  );
}
