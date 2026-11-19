/* The elastic marker (KMK). Copied from kaleoshq.com (docs/rebrand/canopy/index.html in kaleos-site, the KMK block),
   written from Logan's notes of 2026-11-16: a selected shape slides, gets truly longer (width, never a sideways scale)
   and settles with one small overshoot. Two additions for Year Up: opt.bounce and data-kmk-bounce multiply the overshoot. */
var KMK = (function(){
  var RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function calm(){ return !!(RM && RM.matches); }
  function out3(u){ return 1 - Math.pow(1 - u, 3); }
  function inOut3(u){ return u < .5 ? 4 * u * u * u : 1 - Math.pow(2 - 2 * u, 3) / 2; }
  function ramp(u, f){ return u <= 0 ? 0 : u >= 1 ? 1 : f(u); }
  function lead(t){ return ramp(t / .8, out3); }
  /* The leading edge of a slide that takes over from one in flight: it starts at rest, so the old speed hands over */
  function soft(t){ return ramp(t / .85, inOut3); }
  function trail(t){ return ramp((t - .14) / .86, inOut3); }
  /* The shared overshoot: 0 until 45% of the time, up to 1 at 75%, back to 0 at the end (one hump, smooth at both ends) */
  function bump(t){ if (t <= .45 || t >= 1) return 0; if (t < .75){ var s = Math.sin(Math.PI / 2 * (t - .45) / .3); return s * s; } return (1 + Math.cos(Math.PI * (t - .75) / .25)) / 2; }
  /* The old speed, carried on: slope 1 at the start, gone (and still) at 16% of the new slide */
  function carry(t){ var u = .16; return t <= 0 || t >= u ? 0 : t * (1 - t / u) * (1 - t / u); }
  function lerp(a, b, p){ return a + (b - a) * p; }
  function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
  function copy(b){ return b ? { x: b.x, y: b.y, w: b.w, h: b.h, o: b.o } : null; }
  var live = [], memo = {};
  function attach(host, opt){
    opt = opt || {};
    if (host.__kmk) return host.__kmk;
    var mk = opt.mk || document.createElement('span');
    mk.classList.add('kmk'); if (opt.cls) mk.classList.add(opt.cls);
    mk.setAttribute('aria-hidden', 'true');
    if (!opt.mk) host.insertBefore(mk, host.firstChild);
    host.classList.add('kmk-on');
    /* cur: what is drawn. base: the same before thinning. rest: the resting box of the option it is on or headed for.
       vel: the speed of its centre in px per ms, while it moves. */
    var cur = null, base = null, rest = null, vel = { x: 0, y: 0 }, last = null, el = null, raf = 0, A = null;
    function box(t){
      var hr = host.getBoundingClientRect(), r = t.getBoundingClientRect();
      if (!hr.width || !r.width) return null;
      var b = { x: r.left - hr.left - host.clientLeft + host.scrollLeft, y: r.top - hr.top - host.clientTop + host.scrollTop, w: r.width, h: r.height };
      return opt.box ? opt.box(b, t) : b;
    }
    function draw(s){
      mk.style.transform = 'translate(' + s.x.toFixed(2) + 'px,' + s.y.toFixed(2) + 'px)';
      mk.style.width = s.w.toFixed(2) + 'px'; mk.style.height = s.h.toFixed(2) + 'px';
      mk.style.opacity = s.o.toFixed(3);
    }
    function stop(){ if (raf) cancelAnimationFrame(raf); raf = 0; A = null; last = null; mk.classList.remove('kmk-go'); }
    function place(){
      stop(); vel = { x: 0, y: 0 };
      if (!el){ if (cur){ cur.o = 0; draw(cur); } return; }
      var b = box(el); if (!b) return;
      b.o = opt.end ? opt.end(el) : 1; cur = b; base = copy(b); rest = copy(b); draw(cur);
      if (opt.land) opt.land(el);
    }
    function frame(now){
      var t = clamp((now - A.t0) / A.T, 0, 1), f = A.f, g = A.g, s = {};
      var pl = A.lf(t), pt = pl - A.k * (pl - trail(t)), hb = bump(t), c = carry(t) * A.T;
      ['x', 'y'].forEach(function(ax){
        var sz = ax === 'x' ? 'w' : 'h', pa, pb, sa, sb, v = (A.v[ax] || 0) * c;
        if (ax === A.ax){
          if (A.dir > 0){ pb = pl; pa = pt; } else { pa = pl; pb = pt; }
          /* Both edges overshoot together by OL (the room the control has), so the length holds */
          sa = sb = A.dir * A.OL * hb;
        } else { pa = pb = ramp(t / .9, inOut3); sa = sb = 0; }
        var sh = A.sh[ax] * pl, a = lerp(f[ax], g[ax], pa) + sa + v + sh, b = lerp(f[ax] + f[sz], g[ax] + g[sz], pb) + sb + v + sh;
        s[ax] = a; s[sz] = Math.max(0, b - a);
      });
      base = { x: s.x, y: s.y, w: s.w, h: s.h };
      var cx = A.ax === 'x' ? 'y' : 'x', cs = cx === 'x' ? 'w' : 'h', ms = A.ax === 'x' ? 'w' : 'h';
      var stretch = A.S ? clamp((s[ms] - A.ref) / A.S, 0, 1) : 0;
      var th = s[cs] * .06 * stretch; s[cx] += th / 2; s[cs] -= th;
      /* A safety net: the marker never leaves the control */
      var L = A.lim;
      if (s.x < L.x0){ s.w -= L.x0 - s.x; s.x = L.x0; } if (s.x + s.w > L.x1) s.w = L.x1 - s.x;
      if (s.y < L.y0){ s.h -= L.y0 - s.y; s.y = L.y0; } if (s.y + s.h > L.y1) s.h = L.y1 - s.y;
      s.w = Math.max(0, s.w); s.h = Math.max(0, s.h);
      s.o = f.o === g.o ? g.o : g.o > f.o ? lerp(f.o, g.o, clamp(t / .35, 0, 1)) : lerp(f.o, g.o, clamp((t - .62) / .38, 0, 1));
      if (last && now > last.t) vel = { x: (s.x + s.w / 2 - last.x) / (now - last.t), y: (s.y + s.h / 2 - last.y) / (now - last.t) };
      last = { t: now, x: s.x + s.w / 2, y: s.y + s.h / 2 };
      cur = s; draw(s);
      if (t < 1) raf = requestAnimationFrame(frame); else place();
    }
    function to(t, animate, scroll){
      var was = el; el = t || null;
      if (el && el === was){ if (!A && !animate) place(); return; }
      if (!el){
        stop(); vel = { x: 0, y: 0 };
        mk.style.transition = animate && !calm() ? 'opacity 240ms ease' : '';
        if (cur){ cur.o = 0; draw(cur); }
        return;
      }
      mk.style.transition = '';
      var gr = box(el);
      if (!gr){ stop(); return; }
      gr.o = opt.end ? opt.end(el) : 1;
      /* g: where the option is now on screen (its resting box less the scroll still to come); gr: where it rests */
      var sh = { x: scroll && !calm() ? scroll.x || 0 : 0, y: scroll && !calm() ? scroll.y || 0 : 0 };
      var g = { x: gr.x - sh.x, y: gr.y - sh.y, w: gr.w, h: gr.h, o: gr.o };
      if (!animate || calm() || !cur || (el === was && !A)){ place(); return; }
      /* In flight: start from the shape before thinning, keep its speed, and measure against the option it was headed for */
      var moving = !!A || Math.abs(vel.x) + Math.abs(vel.y) > .001;
      var f = moving && base ? { x: base.x, y: base.y, w: base.w, h: base.h, o: cur.o } : copy(cur), r0 = rest || f, v0 = moving ? vel : { x: 0, y: 0 };
      if (f.o < .02 && !A && was === null){ f = { x: gr.x, y: gr.y, w: gr.w, h: gr.h, o: 0 }; g = copy(gr); sh = { x: 0, y: 0 }; r0 = f; v0 = { x: 0, y: 0 }; moving = false; }
      var dx = (g.x + g.w / 2) - (f.x + f.w / 2), dy = (g.y + g.h / 2) - (f.y + f.h / 2);
      var ax = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y', d = ax === 'x' ? dx : dy, ad = Math.abs(d), dir = d < 0 ? -1 : 1;
      var ms = ax === 'x' ? 'w' : 'h', fl = f[ms], gl = g[ms], ref = Math.max(r0[ms], gl);
      /* A new choice further along the way the marker is already going keeps its pace (no carried speed, which would push it on
         and then take the push back). Only a turn-around starts from rest and lets the old speed fade out. */
      var same = moving && (v0[ax] || 0) * dir > 0, lf = moving && !same ? soft : lead;
      var lim = { x0: Math.min(0, f.x, gr.x), y0: Math.min(0, f.y, gr.y), x1: Math.max(host.scrollWidth, f.x + f.w, gr.x + gr.w), y1: Math.max(host.scrollHeight, f.y + f.h, gr.y + gr.h) };
      /* How far each edge travels: the leading one (on the side the marker moves to) and the trailing one */
      var Dl = dir > 0 ? (g[ax] + gl) - (f[ax] + fl) : f[ax] - g[ax], Dt = dir > 0 ? g[ax] - f[ax] : (f[ax] + fl) - (g[ax] + gl);
      var S = ad > .5 ? Math.min(Math.max(.28 * ad, Math.min(12, .35 * ad)), Math.max(.85 * ref, 20), 110) : 0;
      /* The trailing edge's lag k (0 to 1) is chosen so the longest the marker gets is the longer resting option plus S.
         A shape in flight that is already longer only shrinks from there (k stays 0). */
      var k = 0;
      if (S && Dt > 0){
        var peak = function(kk){ var m = -1e9; for (var i = 1; i < 48; i++){ var q = i / 48, a = lf(q), b = a - kk * (a - trail(q)); m = Math.max(m, fl + Dl * a - Dt * b - ref); } return m; };
        var lo = 0, hi = 1; for (var j = 0; j < 18; j++){ var mid = (lo + hi) / 2; if (peak(mid) < S) lo = mid; else hi = mid; }
        k = lo;
      }
      var room = dir > 0 ? (ax === 'x' ? lim.x1 - gr.x - gr.w : lim.y1 - gr.y - gr.h) : (ax === 'x' ? gr.x - lim.x0 : gr.y - lim.y0);
      var BN = opt.bounce || 1, O = (ad > 4 ? clamp(.03 * ad, 1.5, 5) : ad > .5 ? .03 * ad : 0) * BN, OL = clamp(O, 0, Math.max(0, room));
      var T = clamp(420 + .3 * ad, 420, 490);
      /* The old speed carries on for a few frames: at most 16px along the move, 4px across it */
      var cap = function(v, px){ var m = px / (T * .0237); return clamp(v || 0, -m, m); };
      var V = {}; V[ax] = same ? 0 : cap(v0[ax], 16); V[ax === 'x' ? 'y' : 'x'] = cap(v0[ax === 'x' ? 'y' : 'x'], 4);
      stop();
      rest = copy(gr);
      A = { lim: lim, f: f, g: g, sh: sh, ax: ax, dir: dir, OL: OL, k: k, S: S, ref: ref, lf: lf, v: V, T: T, t0: performance.now() };
      mk.classList.add('kmk-go');
      raf = requestAnimationFrame(frame);
    }
    var api = { to: to, place: place, stop: stop, host: host, marker: mk, sel: function(){ return el; }, busy: function(){ return !!A; },
      dur: function(){ return A ? A.T : 0; },
      /* The slide in flight, for a control that moves with it (a strip that scrolls): its start and end boxes, axis,
         direction, clock and how far each edge has gone at a time t from 0 to 1 */
      plan: function(){ if (!A) return null; var P = A; return { f: copy(P.f), g: copy(P.g), ax: P.ax, dir: P.dir, T: P.T, t0: P.t0,
        at: function(t){ var pl = P.lf(t); return { lead: pl, trail: pl - P.k * (pl - trail(t)) }; } }; },
      cur: function(){ return cur; }, base: function(){ return base; }, rest: function(){ return rest; }, vel: function(){ return { x: vel.x, y: vel.y }; },
      /* Take over a marker's place: c is what it drew (kept for this frame), b its shape before thinning (the next slide starts from it) */
      from: function(c, r, v, b){ if (c){ stop(); cur = copy(c); base = copy(b || c); rest = copy(r || c); vel = v ? { x: v.x, y: v.y } : { x: 0, y: 0 }; draw(cur); } } };
    if ('ResizeObserver' in window){
      var ro = new ResizeObserver(function(){ if (!A) place(); });
      ro.observe(host);
      [].forEach.call(host.children, function(c){ if (c !== mk) ro.observe(c); });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ if (!A) place(); });
    host.__kmk = api; live.push(api);
    return api;
  }
  /* Groups marked data-kmk="<attribute test>" (for example aria-pressed="true") follow their own selected option.
     A group that a re-render replaced right after a click or a key press starts from where the old marker was,
     with its speed and the option it was headed for. */
  var input = 0;
  function scan(root){
    for (var i = live.length - 1; i >= 0; i--) if (!live[i].host.isConnected){ live[i].stop(); live.splice(i, 1); }
    [].forEach.call((root || document).querySelectorAll('[data-kmk]'), function(g){
      var test = '[' + g.getAttribute('data-kmk') + ']', key = g.getAttribute('data-kmk-key') || g.getAttribute('aria-label') || '';
      var sel = null; [].forEach.call(g.children, function(c){ if (!sel && c.matches(test)) sel = c; });
      var k = g.__kmk;
      if (!k){
        k = attach(g, { cls: g.getAttribute('data-kmk-cls') || '', bounce: parseFloat(g.getAttribute('data-kmk-bounce')) || 1 });
        var old = memo[key], fresh = old && old !== k && Date.now() - input < 1000 && old.cur();
        if (fresh){ k.from(old.cur(), old.rest(), old.vel(), old.base()); k.to(sel, true); } else k.to(sel, false);
      } else if (sel !== k.sel()) k.to(sel, true);
      if (key) memo[key] = k;
    });
  }
  function auto(root){
    addEventListener('pointerdown', function(){ input = Date.now(); }, true);
    addEventListener('keydown', function(){ input = Date.now(); }, true);
    scan(root);
    if (!('MutationObserver' in window)) return;
    new MutationObserver(function(){ scan(root); }).observe(root || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-current', 'aria-checked', 'aria-selected'] });
  }
  return { attach: attach, auto: auto, calm: calm, lead: lead, trail: trail };
})();
