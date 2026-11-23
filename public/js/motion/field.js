// The shared particle field (CONCEPT §2).
//
// One full-viewport Canvas 2D layer holds one fixed set of N particles. Each
// homepage state contributes a keyframe: an arrangement of those same N
// particles anchored to a scroll position. Scrolling between two anchors
// morphs one arrangement into the next, so scenes never cut.
//
// Keyframe interface:
//   id, state            names (state is the HUD state it belongs to)
//   anchor               scroll Y at which the arrangement is fully formed (set in layout)
//   layout(env)          measure slots and compute the anchor; no per-frame reads
//   type: "globe"        params(env) -> {cx, cy, R, angle, zoom}; filled by globe.fill
//   type: "points"       fill(out, env) writes x, y, a (alpha), s (size) per particle
//   overlay(ctx, w, env) optional extra drawing at weight w ∈ [0, 1]
//   animated(env)        optional; true while it needs frames without scrolling

import {
  clamp, lerp, smooth, easeInOut, mint, dpr, reducedMotion, rng, loop,
} from "./tokens.js";

export class Slot {
  // A DOM box the arrangement is drawn into. Measured once per layout, then
  // converted to viewport coordinates per frame without touching the DOM.
  // `sticky` = { pin, section } for slots inside a position:sticky pin.
  constructor(el, sticky) {
    this.el = el;
    this.sticky = sticky || null;
  }
  measure() {
    const sy = window.scrollY;
    const r = this.el.getBoundingClientRect();
    this.x = r.left;
    this.w = r.width;
    this.h = r.height;
    this.docY = r.top + sy;
    if (this.sticky) {
      const pr = this.sticky.pin.getBoundingClientRect();
      const sr = this.sticky.section.getBoundingClientRect();
      this.relY = r.top - pr.top;
      this.secTop = sr.top + sy;
      this.secEnd = this.secTop + this.sticky.section.offsetHeight - window.innerHeight;
    }
    return this;
  }
  // Viewport rect at scroll position y.
  at(y) {
    let top;
    if (this.sticky) {
      const pinTop = Math.max(this.secTop - y, Math.min(0, this.secEnd - y));
      top = pinTop + this.relY;
    } else top = this.docY - y;
    return { x: this.x, y: top, w: this.w, h: this.h, cx: this.x + this.w / 2, cy: top + this.h / 2 };
  }
  // Scroll Y that centres this slot in the viewport.
  centredAt() {
    return this.docY + this.h / 2 - window.innerHeight / 2;
  }
}

const BUCKETS = 20;

export function createField(canvas, { n, globe, keyframes, onFrame }) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const reduce = reducedMotion();
  const N = n;
  const mk = () => ({ x: new Float32Array(N), y: new Float32Array(N), a: new Float32Array(N), s: new Float32Array(N) });
  const A = mk(), B = mk(), F = mk();
  // Per-particle morph delay: organic, deterministic.
  const D = new Float32Array(N);
  const r = rng(7);
  for (let i = 0; i < N; i++) D[i] = r();

  const order = new Uint32Array(N);
  const counts = new Uint32Array(BUCKETS + 1);
  const start = new Uint32Array(BUCKETS + 1);
  const fillPos = new Uint32Array(BUCKETS + 1);
  let W = 0, H = 0, stride = 1;
  const env = { N, D, reduce, now: 0, y: 0, b: 0, t0: performance.now(), vh: 0, vw: 0 };

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    const k = dpr();
    canvas.width = Math.round(W * k);
    canvas.height = Math.round(H * k);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(k, 0, 0, k, 0, 0);
  }

  function layout() {
    resize();
    env.vh = H;
    env.vw = W;
    keyframes.forEach((k) => k.layout(env));
    // Anchors must be strictly increasing.
    for (let i = 1; i < keyframes.length; i++) {
      if (keyframes[i].anchor <= keyframes[i - 1].anchor) keyframes[i].anchor = keyframes[i - 1].anchor + 1;
    }
    keyframes.forEach((k, i) => {
      k.prevAnchor = i > 0 ? keyframes[i - 1].anchor : null;
      k.nextAnchor = i < keyframes.length - 1 ? keyframes[i + 1].anchor : null;
    });
    kick();
  }

  function locate(y) {
    const last = keyframes.length - 1;
    if (y <= keyframes[0].anchor) return [0, 1, 0];
    if (y >= keyframes[last].anchor) return [last - 1, last, 1];
    let i = 0;
    while (i < last && keyframes[i + 1].anchor <= y) i++;
    const a = keyframes[i].anchor, b = keyframes[i + 1].anchor;
    return [i, i + 1, (y - a) / (b - a)];
  }

  function fillKey(k, out) {
    if (k.type === "globe") globe.fill(k.params(env), out, env, k);
    else k.fill(out, env);
  }

  // Counting sort by alpha bucket so fillStyle changes ~20 times per frame.
  function drawSet(S) {
    counts.fill(0);
    const vis = (i) => S.a[i] > 0.01 && S.x[i] > -8 && S.x[i] < W + 8 && S.y[i] > -8 && S.y[i] < H + 8;
    for (let i = 0; i < N; i += stride) if (vis(i)) counts[Math.min(BUCKETS, Math.round(S.a[i] * BUCKETS))]++;
    let acc = 0;
    for (let k = 0; k <= BUCKETS; k++) { start[k] = fillPos[k] = acc; acc += counts[k]; }
    for (let i = 0; i < N; i += stride) if (vis(i)) order[fillPos[Math.min(BUCKETS, Math.round(S.a[i] * BUCKETS))]++] = i;
    for (let k = 1; k <= BUCKETS; k++) {
      if (!counts[k]) continue;
      ctx.fillStyle = mint(k / BUCKETS);
      for (let j = start[k], e = start[k] + counts[k]; j < e; j++) {
        const i = order[j];
        const s = S.s[i];
        ctx.fillRect(S.x[i] - s / 2, S.y[i] - s / 2, s, s);
      }
    }
  }

  // Frame-time watchdog: halve the drawn particles on a struggling device.
  let slowFrames = 0, lastNow = 0;

  function frame(now) {
    if (lastNow && now - lastNow > 34 && now - lastNow < 200) slowFrames++;
    else if (slowFrames > 0) slowFrames -= 0.25;
    if (slowFrames > 30 && stride === 1) stride = 2;
    lastNow = now;

    env.now = now;
    const y = (env.y = window.scrollY);
    const [ia, ib, local] = locate(y);
    const KA = keyframes[ia], KB = keyframes[ib];
    env.A = KA;
    env.B = KB;
    env.local = local;

    if (reduce) {
      // No morphing: both neighbouring states are drawn in place as static
      // art, so every section shows its own composed frame as it scrolls by.
      env.b = 0;
      ctx.clearRect(0, 0, W, H);
      fillKey(KA, A);
      drawSet(A);
      if (KA.overlay) KA.overlay(ctx, 1, env);
      env.b = 1;
      fillKey(KB, B);
      drawSet(B);
      if (KB.overlay) KB.overlay(ctx, 1, env);
      if (onFrame) onFrame(env);
      return false;
    }

    const b = smooth(0.2, 0.8, local);
    env.b = b;

    if (KA.type === "globe" && KB.type === "globe") {
      // Same object in two places: blend the camera, not the points.
      const pa = KA.params(env), pb = KB.params(env);
      const e = easeInOut(b);
      let da = pb.angle - pa.angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      globe.fill({
        cx: lerp(pa.cx, pb.cx, e), cy: lerp(pa.cy, pb.cy, e), R: lerp(pa.R, pb.R, e),
        angle: pa.angle + da * e, zoom: 0, assemble: pa.assemble,
      }, F, env, KA);
    } else {
      fillKey(KA, A);
      fillKey(KB, B);
      for (let i = 0; i < N; i++) {
        const e = b <= 0 ? 0 : b >= 1 ? 1 : easeInOut(clamp(b * 1.6 - D[i] * 0.6));
        F.x[i] = A.x[i] + (B.x[i] - A.x[i]) * e;
        F.y[i] = A.y[i] + (B.y[i] - A.y[i]) * e;
        F.a[i] = A.a[i] + (B.a[i] - A.a[i]) * e;
        F.s[i] = A.s[i] + (B.s[i] - A.s[i]) * e;
      }
    }

    ctx.clearRect(0, 0, W, H);
    drawSet(F);

    if (KA.overlay && 1 - b > 0.001) KA.overlay(ctx, 1 - b, env);
    if (KB.overlay && b > 0.001) KB.overlay(ctx, b, env);
    if (onFrame) onFrame(env);

    const animated =
      (KA.animated && KA.animated(env) && b < 0.999) ||
      (KB.animated && KB.animated(env) && b > 0.001);
    return animated && !reduce;
  }

  const kick = loop((now) => frame(now));
  // While scrolling, keep drawing; the loop stops itself when idle.
  window.addEventListener("scroll", kick, { passive: true });
  let rt = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(layout, 120);
  });
  if ("ResizeObserver" in window) {
    let first = true;
    new ResizeObserver(() => {
      if (first) { first = false; return; }
      clearTimeout(rt);
      rt = setTimeout(layout, 120);
    }).observe(document.body);
  }

  layout();
  return { layout, kick, env };
}
