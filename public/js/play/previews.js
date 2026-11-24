// Small static previews of each game, drawn in a w×h box. Used by the hub
// cards and by the Open Graph cards (tools/og/card.html). Pure drawing.

import { mint, grey, rng } from "../motion/tokens.js";
import { drawChain, drawNode } from "./markovle/draw.js";

// A fixed decorative chain: never today's puzzle, so the hub spoils nothing.
const DEMO = [[5, 4, 0, 1], [0, 2, 8, 0], [3, 0, 3, 4], [6, 0, 0, 4]];

export const PREVIEW = {
  "how-many"(ctx, w, h) {
    const u = rng(7); // fixed decorative cloud, never a real puzzle
    const s = Math.min(w, h);
    ctx.fillStyle = mint(0.85);
    ctx.beginPath();
    for (let i = 0; i < 70; i++) {
      const cx = i % 2 ? 0.32 : 0.66;
      const x = (cx + (u() + u() + u() - 1.5) * 0.28) * w;
      const y = (0.5 + (u() + u() + u() - 1.5) * 0.42) * h;
      const r = s * (0.012 + u() * 0.014);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = grey(0.9);
    ctx.font = `600 ${Math.round(s * 0.2)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", w / 2, h / 2);
  },
  echo(ctx, w, h) {
    const s = Math.min(w, h) * 0.9;
    const P = [[0.5, 0.16], [0.84, 0.5], [0.5, 0.84], [0.16, 0.5]].map(([x, y]) => [(w - s) / 2 + x * s, (h - s) / 2 + y * s]);
    ctx.strokeStyle = grey(0.1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) ctx.moveTo(...P[a]), ctx.lineTo(...P[b]);
    ctx.stroke();
    const path = [0, 1, 3, 2];
    ctx.strokeStyle = mint(0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    path.forEach((i, k) => (k ? ctx.lineTo(...P[i]) : ctx.moveTo(...P[i])));
    ctx.stroke();
    P.forEach(([x, y], i) => drawNode(ctx, i, x, y, s * 0.07, { glow: i === 2 ? 1 : 0 }));
  },
  reflex(ctx, w, h) {
    const bw = w * 0.52, bh = h * 0.5, x = (w - bw) / 2, y = h * 0.16;
    ctx.fillStyle = mint(0.95);
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = "#050505";
    ctx.font = `600 ${Math.round(bh * 0.32)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("tap!", w / 2, y + bh / 2);
    ctx.fillStyle = grey(0.7);
    ctx.font = `400 ${Math.round(h * 0.07)}px "IBM Plex Mono", monospace`;
    ctx.fillText("231 · 248 · 219 · 262 · 240 ms", w / 2, y + bh + h * 0.14);
  },
  markovle(ctx, w, h) {
    const s = Math.min(w, h) * 0.82;
    drawChain(ctx, DEMO, { x: (w - s) / 2 + s * 0.14, y: (h - s) / 2 + s * 0.14, w: s * 0.72, h: s * 0.72 }, { r: s * 0.06, scale: s / 200 });
  },
  "lost-without-gps"(ctx, w, h) {
    const A = [[0.18, 0.25], [0.84, 0.3], [0.5, 0.86]];
    const T = [0.55, 0.5];
    ctx.lineWidth = 1;
    for (const [ax, ay] of A) {
      const d = Math.hypot((T[0] - ax) * w, (T[1] - ay) * h);
      ctx.strokeStyle = mint(0.35);
      ctx.beginPath();
      ctx.arc(ax * w, ay * h, d, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = grey(0.8);
      ctx.fillRect(ax * w - 3, ay * h - 3, 6, 6);
    }
    ctx.fillStyle = mint(0.9);
    ctx.beginPath();
    ctx.arc(T[0] * w, T[1] * h, 3.5, 0, Math.PI * 2);
    ctx.fill();
  },
  drift(ctx, w, h) {
    ctx.strokeStyle = grey(0.35);
    ctx.lineWidth = 1.2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const c = h * 0.5 + Math.sin(x / w * 5.2) * h * 0.14;
        const half = h * (0.32 - 0.14 * (x / w));
        ctx.lineTo(x, c + side * half);
      }
      ctx.stroke();
    }
    const x = w * 0.3, y = h * 0.5 + Math.sin(0.3 * 5.2) * h * 0.14;
    ctx.fillStyle = grey(0.25);
    ctx.fillRect(x - 5, y + 7, 10, 6); // ghost: the truth
    ctx.fillStyle = mint(0.95);
    ctx.fillRect(x - 5, y - 3, 10, 6); // the estimate
  },
};
