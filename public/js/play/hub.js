// Hub (/play/): card previews, today's daily status, "surprise me", HUD.
// The cards themselves are static HTML so the list works without JS.

import { fitCanvas, mint, grey } from "../motion/tokens.js";
import { mountPlayHud } from "./shell.js";
import { GAMES, bySlug } from "./games.js";
import { puzzleNumber, countdown } from "./daily.js";
import { store } from "./storage.js";
import { drawChain } from "./markovle/draw.js";

const today = puzzleNumber();

// A fixed decorative chain: never today's puzzle, so the hub spoils nothing.
const DEMO = [[5, 4, 0, 1], [0, 2, 8, 0], [3, 0, 3, 4], [6, 0, 0, 4]];

const PREVIEW = {
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

function drawPreviews() {
  document.querySelectorAll(".card").forEach((card) => {
    const c = card.querySelector(".card__art");
    const fn = PREVIEW[card.dataset.slug];
    if (!c || !fn || !c.clientWidth) return;
    const { ctx, w, h } = fitCanvas(c);
    ctx.clearRect(0, 0, w, h);
    fn(ctx, w, h);
  });
}

function playedToday(g) {
  const db = store(g.slug);
  if (g.daily) return !!db.get("results", {})[today];
  return db.get("lastPlayed", 0) === today;
}

function paintStatus() {
  for (const g of GAMES) {
    if (g.status !== "live" || !g.daily) continue;
    const el = document.querySelector(`[data-slug="${g.slug}"] [data-status]`);
    if (!el) continue;
    const res = store(g.slug).get("results", {})[today];
    el.textContent = res
      ? `#${today} · ${res.label || ""} · next in ${countdown()}`
      : `#${today} · not played yet`;
  }
}

mountPlayHud("play");
drawPreviews();
new ResizeObserver(drawPreviews).observe(document.getElementById("cards"));
paintStatus();
setInterval(() => document.visibilityState === "visible" && paintStatus(), 1000);

const surprise = document.getElementById("surprise");
surprise.hidden = false;
surprise.addEventListener("click", () => {
  const live = GAMES.filter((g) => g.status === "live");
  const fresh = live.filter((g) => !playedToday(g));
  const pool = fresh.length ? fresh : live;
  const g = pool[Math.floor(Math.random() * pool.length)] || bySlug("markovle");
  location.href = g.slug + ".html";
});
