// Motion tokens and small shared helpers.
// Durations and easings mirror the custom properties in theme.css (SPEC §10.1).
// Change both together.

export const DUR = {
  micro: 200,
  ui: 360,
  reveal: 700,
  hero: 1600,
};
export const STAGGER = 60;
export const TRAVEL = 14;

export const MINT = [89, 243, 176];
export const mint = (a) => `rgba(89,243,176,${a.toFixed(3)})`;
export const grey = (a) => `rgba(242,242,242,${a.toFixed(3)})`;

export const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const isMobile = () => window.matchMedia("(max-width: 820px)").matches;
export const finePointer = () =>
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// DPR cap: 2 on desktop, 1.5 on mobile (SPEC §12).
export const dpr = () =>
  Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2);

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
// cubic-bezier(0.22, 1, 0.36, 1) is close to easeOutQuint for canvas work.
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 5);
export const easeInOut = (t) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

// Deterministic PRNG (mulberry32) and string hash, for seeded visuals.
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Size a canvas to its CSS box at the capped DPR. Returns {w, h, ctx}.
export function fitCanvas(canvas, w, h) {
  const r = dpr();
  w = w ?? canvas.clientWidth;
  h = h ?? canvas.clientHeight;
  canvas.width = Math.round(w * r);
  canvas.height = Math.round(h * r);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(r, 0, 0, r, 0, 0);
  return { w, h, ctx };
}

// Run fn on every animation frame while `active()` is true and the tab is
// visible. Returns a kick() that restarts the loop after it has gone idle.
export function loop(fn) {
  let running = false;
  const tick = (now) => {
    if (document.visibilityState !== "visible") {
      running = false;
      return;
    }
    const keep = fn(now);
    if (keep) requestAnimationFrame(tick);
    else running = false;
  };
  const kick = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") kick();
  });
  return kick;
}
