// drift: rendering, input and flow. Rules live in sim.js.

import { fitCanvas, loop, reducedMotion, mint, grey } from "../../motion/tokens.js";
import * as D from "./sim.js";
import { puzzleNumber } from "../daily.js";
import { store } from "../storage.js";
import { tone } from "../audio.js";
import { bySlug } from "../games.js";
import { encode, fromLocation } from "../challenge.js";
import { share, shareLabel } from "../share.js";
import { h, mountGamePage, renderEnd, announce, followItem, anotherItem } from "../shell.js";

const game = bySlug(D.SLUG);
const db = store(D.SLUG);
const $ = (id) => document.getElementById(id);
const TICK_MS = 1000 / D.HZ;
const VIEW_UNITS = 180; // world units visible across, at least
const CAM_AT = 0.22; // drone's horizontal position on screen

const canvas = $("game"), stage = $("stage"), status = $("status"), endEl = $("end");
const overlay = $("overlay"), overlayLine = $("overlayLine"), banner = $("banner");

const challenge = fromLocation();
let seed = challenge ? challenge.seed : newSeed();
let s = D.create(seed);
let phase = "ready"; // ready → flying ⇄ paused → over
let climb = false;
let acc = 0, lastNow = 0;
let trail = [];
let fixFlash = -999;
let ctx, cw, ch, scale;

function newSeed() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

// ---------- scores ----------
const runs = () => db.get("runs", []);
const best = () => (runs()[0] ? runs()[0].m : 0);
function saveRun(m) {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const list = [...runs(), { m, d: date }].sort((a, b) => b.m - a.m).slice(0, 5);
  db.set("runs", list);
  db.set("lastPlayed", puzzleNumber());
  return list;
}

// ---------- drawing ----------
function layout() {
  ({ ctx, w: cw, h: ch } = fitCanvas(canvas));
  scale = Math.min(ch / D.WORLD_H, cw / VIEW_UNITS);
}
const oy = () => (ch - D.WORLD_H * scale) / 2;

function draw() {
  if (!ctx) return;
  const viewW = cw / scale;
  const camX = s.x - viewW * CAM_AT;
  const X = (x) => (x - camX) * scale;
  const Y = (y) => oy() + y * scale;
  ctx.clearRect(0, 0, cw, ch);

  // Corridor walls, sampled across the view.
  const n = 90;
  const tops = [], bots = [];
  for (let i = 0; i <= n; i++) {
    const x = camX + (viewW * i) / n;
    const c = D.corridorAt(s, Math.max(0, x));
    tops.push([X(x), Y(c.top)]);
    bots.push([X(x), Y(c.bottom)]);
  }
  ctx.fillStyle = "#0b0d0c";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  tops.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(cw, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, ch);
  bots.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(cw, ch);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = grey(0.45);
  ctx.lineWidth = 1.4;
  for (const pts of [tops, bots]) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }

  // Distance ticks every 50 m along the floor, the challenge target and best.
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  const first = Math.ceil(camX / 500) * 500;
  for (let x = Math.max(0, first); x < camX + viewW; x += 500) {
    ctx.fillStyle = grey(0.22);
    ctx.fillText(`${x / 10} m`, X(x) + 3, ch - 4);
    ctx.fillRect(X(x), ch - 16, 1, 12);
  }
  const marks = [];
  if (challenge) marks.push([challenge.score, "beat " + D.fmt(challenge.score) + " m", mint(0.8)]);
  else if (best()) marks.push([best(), "best " + D.fmt(best()) + " m", grey(0.5)]);
  for (const [m, text, col] of marks) {
    const x = X(m * 10);
    if (x < -2 || x > cw + 2) continue;
    ctx.strokeStyle = col;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ch);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = col;
    ctx.textBaseline = "top";
    ctx.fillText(text, x + 5, 6);
  }

  // UWB gates.
  for (const b of s.beacons) {
    const x = X(b.x);
    if (x < -30 || x > cw + 30) continue;
    const a = b.hit ? 0.35 : 0.95;
    ctx.fillStyle = mint(a);
    ctx.fillRect(x - 1, Y(b.y - D.BEACON_WINDOW) - 6, 3, 6);
    ctx.fillRect(x - 1, Y(b.y + D.BEACON_WINDOW), 3, 6);
    ctx.strokeStyle = mint(a * 0.35);
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(x + 0.5, Y(b.y - D.BEACON_WINDOW));
    ctx.lineTo(x + 0.5, Y(b.y + D.BEACON_WINDOW));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = mint(a * 0.8);
    ctx.textBaseline = "bottom";
    ctx.fillText("uwb", x + 5, Y(b.y - D.BEACON_WINDOW) - 2);
  }

  // Trail of the estimate, the ghost (truth), then the estimate itself.
  const dx = X(s.x);
  ctx.fillStyle = mint(0.25);
  trail.forEach(([tx, ty], i) => {
    const px = X(tx);
    if (px > 0) ctx.fillRect(px - 1, Y(ty) - 1, 2, 2 * (i / trail.length));
  });
  const ga = D.ghostAlpha(s);
  if (ga > 0) {
    ctx.strokeStyle = grey(0.3 * ga);
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(dx, Y(s.y));
    ctx.lineTo(dx, Y(D.shown(s)));
    ctx.stroke();
    ctx.setLineDash([]);
    drone(dx, Y(s.y), grey(0.55 * ga), false);
  }
  const flash = !reducedMotion() && s.tick - fixFlash < 18 ? 1 - (s.tick - fixFlash) / 18 : 0;
  if (flash) {
    ctx.strokeStyle = mint(0.6 * flash);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(dx, Y(D.shown(s)), 10 + 30 * (1 - flash), 0, Math.PI * 2);
    ctx.stroke();
  }
  drone(dx, Y(D.shown(s)), phase === "over" ? "rgba(255,138,122,0.95)" : mint(1), true);
  if (phase === "over") {
    // Show where the drone really was when it hit.
    drone(dx, Y(s.y), "#f2f2f2", false);
    ctx.fillStyle = grey(0.85);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("you were here", dx + 14, Y(s.y));
  }

  // Distance readout.
  ctx.fillStyle = grey(0.9);
  ctx.font = '600 15px "IBM Plex Mono", monospace';
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${D.fmt(D.score(s))} m`, 10, 8);
}

// Drawn to world scale: its height is the collision height.
function drone(x, y, color, rotors) {
  const hh = Math.max(3, D.RADIUS * scale);
  const hw = hh * 1.7;
  ctx.fillStyle = color;
  if (rotors) {
    ctx.fillRect(x - hw, y - hh * 0.45, hw * 2, hh * 1.2);
    ctx.fillRect(x - hw * 1.35, y - hh, hw * 0.8, hh * 0.3);
    ctx.fillRect(x + hw * 0.55, y - hh, hw * 0.8, hh * 0.3);
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - hw, y - hh, hw * 2, hh * 2);
  }
}

// ---------- loop ----------
const kick = loop((now) => {
  if (phase !== "flying") {
    draw();
    return false;
  }
  if (!lastNow) lastNow = now;
  acc += Math.min(250, now - lastNow); // never try to catch up a long stall
  lastNow = now;
  let crashed = false;
  while (acc >= TICK_MS && !crashed) {
    acc -= TICK_MS;
    const fixes = s.fixes;
    D.step(s, climb);
    if (s.tick % 3 === 0) {
      trail.push([s.x, D.shown(s)]);
      if (trail.length > 40) trail.shift();
    }
    if (s.fixes !== fixes) onFix();
    crashed = s.over;
  }
  if (s.tick % 6 === 0) paintStatus();
  draw();
  if (crashed) {
    over();
    return false;
  }
  return true;
});

function paintStatus() {
  const b = best();
  status.textContent = `${D.fmt(D.score(s))} m${b ? ` · best ${D.fmt(b)} m` : ""}${s.fixes ? ` · ${s.fixes} fix${s.fixes > 1 ? "es" : ""}` : ""}`;
}

function onFix() {
  fixFlash = s.tick;
  tone("good");
  try {
    navigator.vibrate && navigator.vibrate(10);
  } catch {}
}

// ---------- flow ----------
function begin() {
  if (phase === "ready") {
    phase = "flying";
    overlay.hidden = true;
    lastNow = 0;
    acc = 0;
    tone("start");
    announce("flying. hold to climb, release to sink.");
    kick();
  } else if (phase === "paused") {
    phase = "flying";
    overlay.hidden = true;
    lastNow = 0;
    kick();
  }
}

function pause() {
  if (phase !== "flying") return;
  phase = "paused";
  climb = false;
  overlayLine.textContent = "paused · hold or press ↑ to carry on";
  overlay.hidden = false;
  draw();
}

function reset(newCourse) {
  if (newCourse && !challenge) seed = newSeed();
  s = D.create(seed);
  phase = "ready";
  climb = false;
  trail = [];
  fixFlash = -999;
  endEl.hidden = true;
  overlayLine.textContent = challenge ? `same course as your friend · hold to fly` : "hold anywhere, or ↑ / space, to fly";
  overlay.hidden = false;
  paintStatus();
  draw();
  stage.focus({ preventScroll: true });
}

function over() {
  phase = "over";
  climb = false;
  tone("bad");
  const m = D.score(s);
  const prevBest = best();
  const list = saveRun(m);
  draw();
  paintStatus();
  const link = `markovstate.sh/play/drift.html?c=${encode(seed, m)}`;
  const lines = [h("span", {}, h("strong", { class: "accent" }, `${D.fmt(m)} m`), prevBest && m > prevBest ? " · new best" : prevBest ? ` · best ${D.fmt(Math.max(prevBest, m))} m` : "")];
  if (challenge) {
    const diff = m - challenge.score;
    lines.push(diff > 0 ? h("span", { class: "accent" }, `you won by ${D.fmt(diff)} m.`) : diff === 0 ? h("span", {}, "dead level. rematch?") : h("span", { class: "muted" }, `short by ${D.fmt(-diff)} m. same course, try again.`));
  } else {
    lines.push(h("span", { class: "muted" }, `"I drifted ${D.fmt(m)} m before my IMU betrayed me."`));
  }
  if (game.ownerBest) lines.push(h("span", { class: "muted" }, `the owner's best: ${D.fmt(game.ownerBest)} m`));
  const top = h(
    "div",
    { class: "end__extra" },
    h("p", { class: "end__meta" }, "your top 5 on this device"),
    h("ol", { class: "top5" }, list.map((r) => h("li", { class: r.m === m ? "is-this" : null }, h("span", {}, `${D.fmt(r.m)} m`), h("span", { class: "muted" }, r.d)))),
  );
  renderEnd(endEl, {
    title: challenge ? `drift · challenge` : "drift",
    lines,
    primary: {
      copy: challenge ? ">> send your own challenge back" : game.cta.copy,
      onClick: async (say) => say(shareLabel[await share(D.shareText(m, link))] || ""),
    },
    again: () => reset(true),
    secondary: [followItem, anotherItem, { label: "read the blog", href: game.post.href }, ...(challenge ? [{ label: "new course", href: "drift.html" }] : [])],
    extra: [top],
  });
  announce(`crashed at ${m} metres.${challenge ? (m > challenge.score ? " you won the challenge." : " challenge not beaten.") : ""}`);
}

// ---------- input ----------
const CLIMB_KEYS = new Set(["ArrowUp", " ", "w", "W"]);
stage.addEventListener("pointerdown", (e) => {
  if (phase === "over") return;
  e.preventDefault();
  stage.setPointerCapture(e.pointerId);
  climb = true;
  begin();
});
const release = () => (climb = false);
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);
stage.addEventListener("lostpointercapture", release);

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest("a, input, textarea, select, button:not(#stage)")) {
    if (!(phase === "flying" && CLIMB_KEYS.has(e.key))) return;
  }
  if (phase === "over") {
    if (e.key === "Enter" || e.key === " " || e.key === "r" || e.key === "R") {
      // Let Enter/Space activate a focused CTA or link instead.
      if (e.target.closest && e.target.closest("a, button")) return;
      e.preventDefault();
      reset(true);
    }
    return;
  }
  if (CLIMB_KEYS.has(e.key)) {
    e.preventDefault();
    if (!e.repeat) {
      climb = true;
      begin();
    }
  } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
    if (phase === "flying") e.preventDefault();
    climb = false;
  } else if ((e.key === "Escape" || e.key === "p" || e.key === "P") && phase === "flying") pause();
});
document.addEventListener("keyup", (e) => {
  if (CLIMB_KEYS.has(e.key)) climb = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") pause();
});
window.addEventListener("blur", () => pause());

new ResizeObserver(() => {
  layout();
  draw();
}).observe(stage);

// ---------- boot ----------
mountGamePage(D.SLUG);
if (challenge) {
  banner.textContent = `>> beat ${D.fmt(challenge.score)} m`;
  banner.hidden = false;
}
reset(false);
