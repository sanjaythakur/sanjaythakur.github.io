// Hub (/play/): card previews, today's daily status, "surprise me", HUD.
// The cards themselves are static HTML so the list works without JS.

import { fitCanvas } from "../motion/tokens.js";
import { mountPlayHud } from "./shell.js";
import { GAMES, bySlug } from "./games.js";
import { puzzleNumber, countdown } from "./daily.js";
import { store } from "./storage.js";
import { PREVIEW } from "./previews.js";

const today = puzzleNumber();

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
    if (g.status !== "live") continue;
    const el = document.querySelector(`[data-slug="${g.slug}"] [data-status]`);
    if (!el) continue;
    if (!g.daily) {
      const top = store(g.slug).get("runs", [])[0];
      el.textContent = top ? `best ${top.m.toLocaleString("en-US")} m` : "no runs yet";
      continue;
    }
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
