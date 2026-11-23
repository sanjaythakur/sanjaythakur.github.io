// s₃ — proof. Readouts on a hairline baseline; numbers scramble-settle once.

import { Slot } from "../field.js";
import { rng } from "../tokens.js";

export function proofKeyframe({ baselineEl, readoutEls }) {
  const slot = new Slot(baselineEl);
  let ticks = [];
  return {
    id: "proof", state: "s3", type: "points",
    layout() {
      slot.measure();
      // One tick per readout column (the grid wraps on small screens).
      ticks = [...new Set(readoutEls.map((el) => Math.round(el.getBoundingClientRect().left)))]
        .filter((x) => x >= slot.x && x <= slot.x + slot.w)
        .sort((a, b) => a - b);
      // Centre on the readouts rather than the hairline itself.
      this.anchor = slot.docY - window.innerHeight * 0.55;
    },
    fill(out, env) {
      const r = slot.at(env.y);
      const N = env.N;
      const tickN = Math.floor(N * 0.12);
      const per = Math.max(1, Math.floor(tickN / Math.max(1, ticks.length)));
      // Rank-ordered by x: baseline spread left → right, tick marks woven in.
      const base = N - per * ticks.length;
      let i = 0;
      for (let t = 0; t <= ticks.length; t++) {
        const x0 = t === 0 ? r.x : ticks[t - 1];
        const x1 = t === ticks.length ? r.x + r.w : ticks[t];
        const segN = Math.round((base * (x1 - x0)) / r.w);
        for (let k = 0; k < segN && i < N; k++, i++) {
          out.x[i] = x0 + ((x1 - x0) * k) / Math.max(1, segN);
          out.y[i] = r.y;
          out.a[i] = 0.2;
          out.s[i] = 1;
        }
        if (t < ticks.length) {
          for (let k = 0; k < per && i < N; k++, i++) {
            out.x[i] = ticks[t];
            out.y[i] = r.y - 2 - (k % 9);
            out.a[i] = 0.55;
            out.s[i] = 1;
          }
        }
      }
      for (; i < N; i++) {
        out.x[i] = r.x + r.w;
        out.y[i] = r.y;
        out.a[i] = 0.2;
        out.s[i] = 1;
      }
    },
  };
}

// Odometer-style scramble that settles on the final value, once, on entry.
// Text length never changes, and the boxes have fixed widths, so nothing shifts.
export function countUp(els, reduce) {
  if (reduce || !("IntersectionObserver" in window)) return;
  const r = rng(3);
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const el = en.target;
        const final = el.dataset.value || el.textContent;
        if (!/\d/.test(final)) return;
        const delay = Number(el.dataset.i || 0) * 60;
        const steps = 12;
        let k = 0;
        setTimeout(function step() {
          k++;
          if (k >= steps) {
            el.textContent = final;
            return;
          }
          // Digits settle left to right.
          const settled = Math.floor((k / steps) * final.length);
          el.textContent = [...final]
            .map((c, j) => (/\d/.test(c) && j >= settled ? String(Math.floor(r() * 10)) : c))
            .join("");
          setTimeout(step, 50);
        }, delay);
      });
    },
    { threshold: 0.6 }
  );
  els.forEach((el) => io.observe(el));
}
