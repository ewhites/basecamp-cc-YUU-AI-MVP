/*
 * The elastic marker (KMK), ported from docs/redesign/vision/kmk.js (the kaleoshq.com KMK block) with the same behaviour.
 * A selected shape slides, gets truly longer (width, never a sideways scale) and settles with one small overshoot.
 * opt.bounce and data-kmk-bounce multiply the overshoot.
 *
 * Changes from the source, none of which change the motion:
 * - typed, and a module instead of a window global; the browser is only touched when a function runs (client only);
 * - attach() reuses a `.kmk` child the host already has (so React owns the marker element);
 * - each marker has destroy(), and auto() returns a cleanup function, so a React effect can undo both.
 */

type Axis = "x" | "y";
type Size = "w" | "h";
type Rect = { x: number; y: number; w: number; h: number };
export type MarkBox = Rect & { o: number };
type Vec = { x: number; y: number };
type Ease = (t: number) => number;

export interface AttachOptions {
  /** An existing marker element. If missing, the host's own `.kmk` child is used, else one is created. */
  mk?: HTMLElement;
  cls?: string;
  /** Multiplies the overshoot. 1.6 on controls, 2 on the switch. */
  bounce?: number;
  box?: (b: Rect, target: Element) => Rect;
  end?: (target: Element) => number;
  land?: (target: Element) => void;
}

export interface Plan {
  f: MarkBox;
  g: MarkBox;
  ax: Axis;
  dir: number;
  T: number;
  t0: number;
  at: (t: number) => { lead: number; trail: number };
}

export interface Marker {
  to: (target: Element | null, animate?: boolean, scroll?: Partial<Vec>) => void;
  place: () => void;
  stop: () => void;
  destroy: () => void;
  host: HTMLElement;
  marker: HTMLElement;
  sel: () => Element | null;
  busy: () => boolean;
  dur: () => number;
  plan: () => Plan | null;
  cur: () => MarkBox | null;
  base: () => MarkBox | null;
  rest: () => MarkBox | null;
  vel: () => Vec;
  from: (c: MarkBox | null, r?: MarkBox | null, v?: Vec | null, b?: MarkBox | null) => void;
}

const SIZE: Record<Axis, Size> = { x: "w", y: "h" };
const other = (ax: Axis): Axis => (ax === "x" ? "y" : "x");

export function calm(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
const out3: Ease = (u) => 1 - Math.pow(1 - u, 3);
const inOut3: Ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(2 - 2 * u, 3) / 2);
const ramp = (u: number, f: Ease) => (u <= 0 ? 0 : u >= 1 ? 1 : f(u));
export const lead: Ease = (t) => ramp(t / 0.8, out3);
/* The leading edge of a slide that takes over from one in flight: it starts at rest, so the old speed hands over */
const soft: Ease = (t) => ramp(t / 0.85, inOut3);
export const trail: Ease = (t) => ramp((t - 0.14) / 0.86, inOut3);
/* The shared overshoot: 0 until 45% of the time, up to 1 at 75%, back to 0 at the end (one hump, smooth at both ends) */
function bump(t: number): number {
  if (t <= 0.45 || t >= 1) return 0;
  if (t < 0.75) {
    const s = Math.sin(((Math.PI / 2) * (t - 0.45)) / 0.3);
    return s * s;
  }
  return (1 + Math.cos((Math.PI * (t - 0.75)) / 0.25)) / 2;
}
/* The old speed, carried on: slope 1 at the start, gone (and still) at 16% of the new slide */
function carry(t: number): number {
  const u = 0.16;
  return t <= 0 || t >= u ? 0 : t * (1 - t / u) * (1 - t / u);
}
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
function copy(b: MarkBox | null): MarkBox | null {
  return b ? { x: b.x, y: b.y, w: b.w, h: b.h, o: b.o } : null;
}

interface Anim {
  lim: { x0: number; y0: number; x1: number; y1: number };
  f: MarkBox;
  g: MarkBox;
  sh: Vec;
  ax: Axis;
  dir: number;
  OL: number;
  k: number;
  S: number;
  ref: number;
  lf: Ease;
  v: Vec;
  T: number;
  t0: number;
}

const registry = new WeakMap<HTMLElement, Marker>();
const live: Marker[] = [];
const memo = new Map<string, Marker>();

export function attach(host: HTMLElement, opt: AttachOptions = {}): Marker {
  const known = registry.get(host);
  if (known) return known;
  const own = opt.mk ?? Array.from(host.children).find((c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains("kmk")) ?? null;
  const mk = own ?? document.createElement("span");
  mk.classList.add("kmk");
  if (opt.cls) mk.classList.add(opt.cls);
  mk.setAttribute("aria-hidden", "true");
  if (!own) host.insertBefore(mk, host.firstChild);
  host.classList.add("kmk-on");

  /* cur: what is drawn. base: the same before thinning. rest: the resting box of the option it is on or headed for.
     vel: the speed of its centre in px per ms, while it moves. */
  let cur: MarkBox | null = null;
  let base: MarkBox | null = null;
  let rest: MarkBox | null = null;
  let vel: Vec = { x: 0, y: 0 };
  let last: { t: number; x: number; y: number } | null = null;
  let el: Element | null = null;
  let raf = 0;
  let A: Anim | null = null;
  let gone = false;
  let ro: ResizeObserver | null = null;

  function box(t: Element): MarkBox | null {
    const hr = host.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    if (!hr.width || !r.width) return null;
    const b: Rect = { x: r.left - hr.left - host.clientLeft + host.scrollLeft, y: r.top - hr.top - host.clientTop + host.scrollTop, w: r.width, h: r.height };
    const out = opt.box ? opt.box(b, t) : b;
    return { x: out.x, y: out.y, w: out.w, h: out.h, o: 1 };
  }
  function draw(s: MarkBox) {
    mk.style.transform = "translate(" + s.x.toFixed(2) + "px," + s.y.toFixed(2) + "px)";
    mk.style.width = s.w.toFixed(2) + "px";
    mk.style.height = s.h.toFixed(2) + "px";
    mk.style.opacity = s.o.toFixed(3);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    A = null;
    last = null;
    mk.classList.remove("kmk-go");
  }
  function place() {
    stop();
    vel = { x: 0, y: 0 };
    if (!el) {
      if (cur) {
        cur.o = 0;
        draw(cur);
      }
      return;
    }
    const b = box(el);
    if (!b) return;
    b.o = opt.end ? opt.end(el) : 1;
    cur = b;
    base = copy(b);
    rest = copy(b);
    draw(cur);
    if (opt.land) opt.land(el);
  }
  function frame(now: number) {
    const P = A;
    if (!P) return;
    const t = clamp((now - P.t0) / P.T, 0, 1);
    const f = P.f;
    const g = P.g;
    const s: MarkBox = { x: 0, y: 0, w: 0, h: 0, o: 0 };
    const pl = P.lf(t);
    const pt = pl - P.k * (pl - trail(t));
    const hb = bump(t);
    const c = carry(t) * P.T;
    for (const ax of ["x", "y"] as const) {
      const sz = SIZE[ax];
      let pa: number, pb: number, sa: number, sb: number;
      const v = (P.v[ax] || 0) * c;
      if (ax === P.ax) {
        if (P.dir > 0) {
          pb = pl;
          pa = pt;
        } else {
          pa = pl;
          pb = pt;
        }
        /* Both edges overshoot together by OL (the room the control has), so the length holds */
        sa = sb = P.dir * P.OL * hb;
      } else {
        pa = pb = ramp(t / 0.9, inOut3);
        sa = sb = 0;
      }
      const sh = P.sh[ax] * pl;
      const a = lerp(f[ax], g[ax], pa) + sa + v + sh;
      const b = lerp(f[ax] + f[sz], g[ax] + g[sz], pb) + sb + v + sh;
      s[ax] = a;
      s[sz] = Math.max(0, b - a);
    }
    base = { x: s.x, y: s.y, w: s.w, h: s.h, o: cur ? cur.o : 1 };
    const cx = other(P.ax);
    const cs = SIZE[cx];
    const ms = SIZE[P.ax];
    const stretch = P.S ? clamp((s[ms] - P.ref) / P.S, 0, 1) : 0;
    const th = s[cs] * 0.06 * stretch;
    s[cx] += th / 2;
    s[cs] -= th;
    /* A safety net: the marker never leaves the control */
    const L = P.lim;
    if (s.x < L.x0) {
      s.w -= L.x0 - s.x;
      s.x = L.x0;
    }
    if (s.x + s.w > L.x1) s.w = L.x1 - s.x;
    if (s.y < L.y0) {
      s.h -= L.y0 - s.y;
      s.y = L.y0;
    }
    if (s.y + s.h > L.y1) s.h = L.y1 - s.y;
    s.w = Math.max(0, s.w);
    s.h = Math.max(0, s.h);
    s.o = f.o === g.o ? g.o : g.o > f.o ? lerp(f.o, g.o, clamp(t / 0.35, 0, 1)) : lerp(f.o, g.o, clamp((t - 0.62) / 0.38, 0, 1));
    if (last && now > last.t) vel = { x: (s.x + s.w / 2 - last.x) / (now - last.t), y: (s.y + s.h / 2 - last.y) / (now - last.t) };
    last = { t: now, x: s.x + s.w / 2, y: s.y + s.h / 2 };
    cur = s;
    draw(s);
    if (t < 1) raf = requestAnimationFrame(frame);
    else place();
  }
  function to(target: Element | null, animate = false, scroll?: Partial<Vec>) {
    if (gone) return;
    const was = el;
    el = target || null;
    if (el && el === was) {
      if (!A && !animate) place();
      return;
    }
    if (!el) {
      stop();
      vel = { x: 0, y: 0 };
      mk.style.transition = animate && !calm() ? "opacity 240ms ease" : "";
      if (cur) {
        cur.o = 0;
        draw(cur);
      }
      return;
    }
    mk.style.transition = "";
    const gr = box(el);
    if (!gr) {
      stop();
      return;
    }
    gr.o = opt.end ? opt.end(el) : 1;
    /* g: where the option is now on screen (its resting box less the scroll still to come); gr: where it rests */
    let sh: Vec = { x: scroll && !calm() ? scroll.x || 0 : 0, y: scroll && !calm() ? scroll.y || 0 : 0 };
    let g: MarkBox = { x: gr.x - sh.x, y: gr.y - sh.y, w: gr.w, h: gr.h, o: gr.o };
    if (!animate || calm() || !cur || (el === was && !A)) {
      place();
      return;
    }
    /* In flight: start from the shape before thinning, keep its speed, and measure against the option it was headed for */
    let moving = !!A || Math.abs(vel.x) + Math.abs(vel.y) > 0.001;
    let f: MarkBox = moving && base ? { x: base.x, y: base.y, w: base.w, h: base.h, o: cur.o } : copy(cur)!;
    let r0: MarkBox = rest || f;
    let v0: Vec = moving ? vel : { x: 0, y: 0 };
    if (f.o < 0.02 && !A && was === null) {
      f = { x: gr.x, y: gr.y, w: gr.w, h: gr.h, o: 0 };
      g = copy(gr)!;
      sh = { x: 0, y: 0 };
      r0 = f;
      v0 = { x: 0, y: 0 };
      moving = false;
    }
    const dx = g.x + g.w / 2 - (f.x + f.w / 2);
    const dy = g.y + g.h / 2 - (f.y + f.h / 2);
    const ax: Axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    const d = ax === "x" ? dx : dy;
    const ad = Math.abs(d);
    const dir = d < 0 ? -1 : 1;
    const ms = SIZE[ax];
    const fl = f[ms];
    const gl = g[ms];
    const ref = Math.max(r0[ms], gl);
    /* A new choice further along the way the marker is already going keeps its pace (no carried speed, which would push it on
       and then take the push back). Only a turn-around starts from rest and lets the old speed fade out. */
    const same = moving && (v0[ax] || 0) * dir > 0;
    const lf = moving && !same ? soft : lead;
    const lim = {
      x0: Math.min(0, f.x, gr.x),
      y0: Math.min(0, f.y, gr.y),
      x1: Math.max(host.scrollWidth, f.x + f.w, gr.x + gr.w),
      y1: Math.max(host.scrollHeight, f.y + f.h, gr.y + gr.h),
    };
    /* How far each edge travels: the leading one (on the side the marker moves to) and the trailing one */
    const Dl = dir > 0 ? g[ax] + gl - (f[ax] + fl) : f[ax] - g[ax];
    const Dt = dir > 0 ? g[ax] - f[ax] : f[ax] + fl - (g[ax] + gl);
    const S = ad > 0.5 ? Math.min(Math.max(0.28 * ad, Math.min(12, 0.35 * ad)), Math.max(0.85 * ref, 20), 110) : 0;
    /* The trailing edge's lag k (0 to 1) is chosen so the longest the marker gets is the longer resting option plus S.
       A shape in flight that is already longer only shrinks from there (k stays 0). */
    let k = 0;
    if (S && Dt > 0) {
      const peak = (kk: number) => {
        let m = -1e9;
        for (let i = 1; i < 48; i++) {
          const q = i / 48;
          const a = lf(q);
          const b = a - kk * (a - trail(q));
          m = Math.max(m, fl + Dl * a - Dt * b - ref);
        }
        return m;
      };
      let lo = 0;
      let hi = 1;
      for (let j = 0; j < 18; j++) {
        const mid = (lo + hi) / 2;
        if (peak(mid) < S) lo = mid;
        else hi = mid;
      }
      k = lo;
    }
    const room = dir > 0 ? (ax === "x" ? lim.x1 - gr.x - gr.w : lim.y1 - gr.y - gr.h) : ax === "x" ? gr.x - lim.x0 : gr.y - lim.y0;
    const BN = opt.bounce || 1;
    const O = (ad > 4 ? clamp(0.03 * ad, 1.5, 5) : ad > 0.5 ? 0.03 * ad : 0) * BN;
    const OL = clamp(O, 0, Math.max(0, room));
    const T = clamp(420 + 0.3 * ad, 420, 490);
    /* The old speed carries on for a few frames: at most 16px along the move, 4px across it */
    const cap = (v: number, px: number) => {
      const m = px / (T * 0.0237);
      return clamp(v || 0, -m, m);
    };
    const V: Vec = { x: 0, y: 0 };
    V[ax] = same ? 0 : cap(v0[ax], 16);
    V[other(ax)] = cap(v0[other(ax)], 4);
    stop();
    rest = copy(gr);
    A = { lim, f, g, sh, ax, dir, OL, k, S, ref, lf, v: V, T, t0: performance.now() };
    mk.classList.add("kmk-go");
    raf = requestAnimationFrame(frame);
  }
  function destroy() {
    if (gone) return;
    gone = true;
    stop();
    ro?.disconnect();
    ro = null;
    registry.delete(host);
    const i = live.indexOf(api);
    if (i >= 0) live.splice(i, 1);
    host.classList.remove("kmk-on");
    if (!own) mk.remove();
  }

  const api: Marker = {
    to,
    place,
    stop,
    destroy,
    host,
    marker: mk,
    sel: () => el,
    busy: () => !!A,
    dur: () => (A ? A.T : 0),
    /* The slide in flight, for a control that moves with it (a strip that scrolls): its start and end boxes, axis,
       direction, clock and how far each edge has gone at a time t from 0 to 1 */
    plan: () => {
      if (!A) return null;
      const P = A;
      return {
        f: copy(P.f)!,
        g: copy(P.g)!,
        ax: P.ax,
        dir: P.dir,
        T: P.T,
        t0: P.t0,
        at: (t: number) => {
          const pl = P.lf(t);
          return { lead: pl, trail: pl - P.k * (pl - trail(t)) };
        },
      };
    },
    cur: () => cur,
    base: () => base,
    rest: () => rest,
    vel: () => ({ x: vel.x, y: vel.y }),
    /* Take over a marker's place: c is what it drew (kept for this frame), b its shape before thinning (the next slide starts from it) */
    from: (c, r, v, b) => {
      if (!c) return;
      stop();
      cur = copy(c);
      base = copy(b || c);
      rest = copy(r || c);
      vel = v ? { x: v.x, y: v.y } : { x: 0, y: 0 };
      draw(c);
    },
  };

  if ("ResizeObserver" in window) {
    ro = new ResizeObserver(() => {
      if (!A && !gone) place();
    });
    ro.observe(host);
    Array.from(host.children).forEach((c) => {
      if (c !== mk) ro?.observe(c);
    });
  }
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(() => {
      if (!A && !gone) place();
    });
  registry.set(host, api);
  live.push(api);
  return api;
}

/* Groups marked data-kmk="<attribute test>" (for example aria-pressed="true") follow their own selected option.
   A group that a re-render replaced right after a click or a key press starts from where the old marker was,
   with its speed and the option it was headed for. */
let input = 0;
function scan(root: ParentNode) {
  for (let i = live.length - 1; i >= 0; i--) {
    const m = live[i];
    if (m && !m.host.isConnected) m.destroy();
  }
  root.querySelectorAll<HTMLElement>("[data-kmk]").forEach((g) => {
    const test = "[" + g.getAttribute("data-kmk") + "]";
    const key = g.getAttribute("data-kmk-key") || g.getAttribute("aria-label") || "";
    let sel: Element | null = null;
    for (const c of Array.from(g.children)) {
      if (!c.classList.contains("kmk") && c.matches(test)) {
        sel = c;
        break;
      }
    }
    let k = registry.get(g);
    if (!k) {
      k = attach(g, { cls: g.getAttribute("data-kmk-cls") || "", bounce: parseFloat(g.getAttribute("data-kmk-bounce") || "") || 1 });
      const old = memo.get(key);
      const fresh = old && old !== k && Date.now() - input < 1000 ? old.cur() : null;
      if (old && fresh) {
        k.from(fresh, old.rest(), old.vel(), old.base());
        k.to(sel, true);
      } else k.to(sel, false);
    } else if (sel !== k.sel()) k.to(sel, true);
    if (key) memo.set(key, k);
  });
}

/** Runs the marker on every [data-kmk] group under root, now and after each change. Returns a cleanup function. */
export function auto(root: HTMLElement): () => void {
  const onInput = () => {
    input = Date.now();
  };
  addEventListener("pointerdown", onInput, true);
  addEventListener("keydown", onInput, true);
  scan(root);
  let mo: MutationObserver | null = null;
  if ("MutationObserver" in window) {
    mo = new MutationObserver(() => scan(root));
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed", "aria-current", "aria-checked", "aria-selected"] });
  }
  return () => {
    removeEventListener("pointerdown", onInput, true);
    removeEventListener("keydown", onInput, true);
    mo?.disconnect();
    for (let i = live.length - 1; i >= 0; i--) {
      const m = live[i];
      /* Only the groups auto() runs; a control that attached its own marker (the switch) cleans up itself */
      if (m && m.host.hasAttribute("data-kmk") && (!m.host.isConnected || root.contains(m.host))) m.destroy();
    }
  };
}
