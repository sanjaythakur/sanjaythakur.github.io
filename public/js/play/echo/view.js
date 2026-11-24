// echo: rendering, input and flow. Rules live in sim.js.
// The canvas draws the shapes, links and the hopping dot; four transparent
// buttons sit over the shapes for touch, mouse, keyboard and screen readers.

import { fitCanvas, loop, reducedMotion, easeInOut, mint, grey } from "../../motion/tokens.js";
import * as S from "./sim.js";
import { drawNode } from "../markovle/draw.js";
import { puzzleNumber } from "../daily.js";
import { store } from "../storage.js";
import { tone } from "../audio.js";
import { share, shareLabel } from "../share.js";
import { encode, fromLocation } from "../challenge.js";
import { bySlug } from "../games.js";
import { h, mountGamePage, renderEnd, announce, followItem, anotherItem, bringIntoView } from "../shell.js";

const game = bySlug(S.SLUG);
const db = store(S.SLUG);
const $ = (id) => document.getElementById(id);
const NAMES = ["A", "B", "C", "D"];
// Diamond layout in a unit square; the pad buttons use the same numbers in CSS.
const POS = [[0.5, 0.18], [0.82, 0.5], [0.5, 0.82], [0.18, 0.5]];
const NOTES = [392, 494, 587, 698];
const KEYS = { 1: 0, 2: 1, 3: 2, 4: 3, ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
const LIT_MS = 260;
const PAUSE_MS = 700; // between "level done" and the next playback

const challenge = fromLocation();
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
let seed = challenge ? challenge.seed : newSeed();
let state = S.create(seed);
// intro → watch → input → (pause → watch …) → end
let phase = "intro";
let t0 = 0; // start of the current playback or pause
let dot = { from: 0, to: 0, at: 0 }; // the dot's hop, for animation
const lit = [0, 0, 0, 0]; // time each node was last lit

const stage = $("stage"), canvas = $("links"), intro = $("intro"), status = $("status"), msg = $("msg"), endEl = $("end");
const pads = [...document.querySelectorAll(".pad")];
let ctx, cw, ch;

// ---------- persistence ----------
const runs = () => db.get("runs", []);
function saveRun(s) {
  const d = new Date().toISOString().slice(0, 10);
  const list = [...runs(), { m: s, d }].sort((a, b) => b.m - a.m).slice(0, 5);
  db.set("runs", list);
  db.set("lastPlayed", puzzleNumber());
  return list;
}

// ---------- drawing ----------
function resize() {
  ({ ctx, w: cw, h: ch } = fitCanvas(canvas));
  draw(performance.now());
}
const at = (i) => ({ x: POS[i][0] * cw, y: POS[i][1] * ch });

function draw(now) {
  if (!ctx) return false;
  ctx.clearRect(0, 0, cw, ch);
  const r = Math.max(16, Math.min(cw, ch) * 0.085);
  // Every pair joined by a faint link: the dot can hop anywhere.
  ctx.strokeStyle = grey(0.09);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let a = 0; a < 4; a++)
    for (let b = a + 1; b < 4; b++) {
      const p = at(a), q = at(b);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
  ctx.stroke();

  let busy = false;
  for (let i = 0; i < 4; i++) {
    const p = at(i);
    const age = now - lit[i];
    const g = age < LIT_MS ? 1 : age < LIT_MS + 220 ? 1 - (age - LIT_MS) / 220 : 0;
    if (g > 0) busy = true;
    ctx.globalAlpha = 0.5 + 0.5 * g;
    drawNode(ctx, i, p.x, p.y, r * (1 + 0.12 * g), { glow: g * 1.6 });
    ctx.globalAlpha = 1;
    if (state.over && i === state.wrong) {
      ctx.strokeStyle = "#ff8a7a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.55, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // The dot: glides from node to node; snaps when motion is reduced.
  if (phase !== "intro") {
    const dur = Math.min(220, S.hopMs(state.level) * 0.4);
    const f = reducedMotion() ? 1 : easeInOut((now - dot.at) / dur);
    if (f < 1) busy = true;
    const p = at(dot.from), q = at(dot.to);
    const x = p.x + (q.x - p.x) * f, y = p.y + (q.y - p.y) * f;
    ctx.save();
    ctx.shadowColor = "#59f3b0";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#f2f2f2";
    ctx.beginPath();
    ctx.arc(x, y - r * 1.45, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return busy;
}

function light(i, now) {
  lit[i] = now;
  dot = { from: dot.to, to: i, at: now };
  tone("note", NOTES[i]);
}

// ---------- flow ----------
let shownUpTo = -1;
const frame = loop((now) => {
  if (phase === "watch") {
    const path = S.shown(state);
    const hop = S.hopMs(state.level);
    const k = Math.floor((now - t0) / hop);
    if (k > shownUpTo && k < path.length) {
      shownUpTo = k;
      light(path[k], now);
    }
    if (k >= path.length && now - t0 >= path.length * hop) toInput();
  } else if (phase === "pause" && now - t0 >= PAUSE_MS) {
    playback(now);
  }
  const busy = draw(now);
  return busy || phase === "watch" || phase === "pause";
});

function setStatus() {
  const s = S.score(state);
  const best = runs()[0];
  status.textContent = `level ${state.level} · ${S.fmt(s)} so far` + (best ? ` · best ${S.fmt(best.m)}` : "");
}

function setPads(on) {
  pads.forEach((p) => (p.disabled = !on));
}

function playback(now) {
  phase = "watch";
  t0 = now + 250;
  shownUpTo = -1;
  setPads(false);
  stage.classList.remove("is-yours");
  msg.textContent = "watch…";
  setStatus();
  announce(`level ${state.level}. watch ${state.level + 1} shapes.`);
  frame();
}

function toInput() {
  phase = "input";
  setPads(true);
  stage.classList.add("is-yours");
  msg.textContent = `your turn · ${state.level + 1} to tap`;
  announce(`your turn. tap ${state.level + 1} shapes in order: keys 1 to 4 or the arrow keys.`);
}

function tap(i) {
  if (phase !== "input") return;
  const now = performance.now();
  light(i, now);
  state = S.step(state, { tap: i });
  if (state.result === "wrong") {
    tone("bad");
    finish(now);
  } else if (state.result === "level") {
    tone("good");
    phase = "pause";
    t0 = now;
    setPads(false);
    msg.textContent = `✓ ${S.fmt(S.score(state))}`;
    setStatus();
    if (state.over) finish(now);
  } else {
    msg.textContent = `${state.pos} / ${state.level + 1}`;
  }
  frame();
}

function start() {
  if (phase !== "intro") return;
  intro.hidden = true;
  bringIntoView(stage);
  tone("start");
  dot = { from: state.path[0], to: state.path[0], at: 0 };
  playback(performance.now());
}

function reset(newCourse) {
  if (newCourse && !challenge) seed = newSeed();
  state = S.create(seed);
  phase = "intro";
  endEl.hidden = true;
  stage.hidden = false;
  msg.hidden = false;
  msg.textContent = "";
  lit.fill(0);
  setPads(false);
  stage.classList.remove("is-yours");
  start();
}

function finish(now) {
  phase = "end";
  setPads(false);
  stage.classList.remove("is-yours");
  const s = S.score(state);
  const list = saveRun(s);
  const want = state.path[state.pos];
  const link = `markovstate.sh/play/echo.html?c=${encode(seed, s)}`;
  msg.textContent = state.over && state.wrong >= 0 ? `✕ it was ${NAMES[want]}, not ${NAMES[state.wrong]}` : "";
  // Show the right shape glowing for a moment.
  if (state.wrong >= 0) setTimeout(() => (lit[want] = performance.now(), frame()), 350);
  tone("finish");
  const lines = [h("span", {}, h("strong", { class: "accent" }, S.fmt(s)), ` · ${S.tier(s)}`)];
  if (challenge) {
    const diff = s - challenge.score;
    lines.push(diff > 0 ? h("span", { class: "accent" }, `you won by ${S.fmt(diff)}.`) : diff === 0 ? h("span", {}, "dead level. rematch?") : h("span", { class: "muted" }, `short by ${S.fmt(-diff)}. same path, try again.`));
  }
  const doShare = async (say) => say(shareLabel[await share(S.shareText(s, link))] || "");
  renderEnd(endEl, {
    title: challenge ? "echo · challenge" : "echo",
    lines,
    primary: { copy: challenge ? ">> send your own challenge back" : game.cta.copy, onClick: doShare },
    again: () => reset(true),
    secondary: [followItem, anotherItem, { label: "read: be a markov state", href: game.post.href }, ...(challenge ? [{ label: "new path", href: "echo.html" }] : [])],
    extra: [h("div", { class: "end__extra" }, h("p", { class: "end__meta" }, "your best on this device"), h("ol", { class: "top5" }, list.map((r) => h("li", { class: r.m === s ? "is-this" : null }, h("span", {}, S.fmt(r.m)), h("span", { class: "muted" }, r.d)))))],
  });
  setTimeout(() => phase === "end" && bringIntoView(endEl), 1100);
  announce(`game over at ${S.fmt(s)}. ${state.wrong >= 0 ? `it was ${NAMES[want]}.` : ""}`);
  setStatus();
}

// ---------- input ----------
pads.forEach((p, i) => p.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  tap(i);
}));
// Keyboard activation of a focused pad (Enter / Space) arrives as a click with detail 0.
pads.forEach((p, i) => p.addEventListener("click", (e) => e.detail === 0 && tap(i)));

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest("a, input, textarea, select")) return;
  const k = e.key;
  if (phase === "intro" && (k === "Enter" || k === " ")) {
    e.preventDefault();
    start();
  } else if (phase === "end" && (k === "Enter" || k === " " || k === "r" || k === "R") && !e.target.closest(".end")) {
    e.preventDefault();
    reset(true);
  } else if ((phase === "input" || phase === "watch" || phase === "pause") && k in KEYS) {
    e.preventDefault();
    tap(KEYS[k]);
  }
});
$("start").addEventListener("click", start);
new ResizeObserver(resize).observe(stage);

// ---------- boot ----------
mountGamePage(S.SLUG);
setPads(false);
if (challenge) {
  const b = $("banner");
  b.textContent = `>> beat ${S.fmt(challenge.score)} · same path as your friend`;
  b.hidden = false;
}
setStatus();
resize();
