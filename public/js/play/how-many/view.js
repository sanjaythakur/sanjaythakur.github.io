// how many?: rendering, input and flow. Rules live in sim.js.

import { fitCanvas, loop, mint, grey } from "../../motion/tokens.js";
import * as S from "./sim.js";
import { puzzleNumber, streak } from "../daily.js";
import { store } from "../storage.js";
import { tone } from "../audio.js";
import { share, shareLabel } from "../share.js";
import { h, mountGamePage, renderEnd, announce, followItem, anotherItem, dailyClock, dailyHistory, bringIntoView } from "../shell.js";

const db = store(S.SLUG);
const $ = (id) => document.getElementById(id);
const READY_MS = 900;

const today = puzzleNumber();
let state = S.create(today);
let round = 0;
// intro → ready → show → guess → answered → … → end
let phase = "intro";
let clock = 0; // ms spent in the current phase, counted only while visible
let last = 0;

const stage = $("stage"), canvas = $("dots"), intro = $("intro"), status = $("status");
const form = $("guess"), input = $("guessIn"), feedback = $("feedback"), endEl = $("end");
let ctx, cw, ch;

// ---------- persistence ----------
const results = () => db.get("results", {});
// `seen`: the cloud already flashed, so a reload goes straight to the guess.
const saveProgress = (seen = -1) => db.set("progress", { puzzle: today, g: state.guesses, seen });
let resumeSeen = false;
function saveResult() {
  const pct = S.score(state);
  const res = { g: state.guesses, n: state.rounds.map((r) => r.n), pct, label: `${pct}% off` };
  const r = results();
  r[today] = res;
  db.set("results", r);
  db.set("progress", null);
  const best = db.get("best", null);
  if (best == null || pct < best) db.set("best", pct);
  return res;
}

// ---------- drawing ----------
const cur = () => state.rounds[Math.min(round, S.ROUNDS - 1)];

function resize() {
  ({ ctx, w: cw, h: ch } = fitCanvas(canvas));
  draw();
}

function field() {
  const s = Math.min(cw / S.W, ch / S.H);
  return { s, ox: (cw - S.W * s) / 2, oy: (ch - S.H * s) / 2 };
}

function centreText(text, size, colour) {
  ctx.fillStyle = colour;
  ctx.font = `600 ${size}px "IBM Plex Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cw / 2, ch / 2);
}

function drawDots(alpha) {
  const { s, ox, oy } = field();
  ctx.fillStyle = mint(alpha);
  ctx.beginPath();
  for (const d of cur().dots) {
    ctx.moveTo(ox + (d.x + d.r) * s, oy + d.y * s);
    ctx.arc(ox + d.x * s, oy + d.y * s, Math.max(1.5, d.r * s), 0, Math.PI * 2);
  }
  ctx.fill();
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, cw, ch);
  const { s, ox, oy } = field();
  ctx.strokeStyle = grey(0.08);
  ctx.strokeRect(ox + 0.5, oy + 0.5, S.W * s - 1, S.H * s - 1);
  const big = Math.max(22, Math.min(56, cw * 0.08));
  if (phase === "ready") {
    centreText(`round ${round + 1}`, big * 0.6, grey(0.85));
  } else if (phase === "show") {
    drawDots(0.92);
    // A thin bar along the bottom shows how long the cloud stays.
    const left = Math.max(0, 1 - clock / cur().ms);
    ctx.fillStyle = mint(0.5);
    ctx.fillRect(ox, oy + S.H * s - 3, S.W * s * left, 3);
  } else if (phase === "guess") {
    centreText("?", big * 1.6, grey(0.18));
  } else if (phase === "answered") {
    drawDots(0.55);
    centreText(String(cur().n), big * 1.3, grey(0.95));
  }
}

// ---------- flow ----------
const frame = loop((now) => {
  const dt = Math.min(50, now - (last || now));
  last = now;
  clock += dt;
  if (phase === "ready" && clock >= READY_MS) {
    phase = "show";
    clock = 0;
    saveProgress(round);
    tone("tick");
  } else if (phase === "show" && clock >= cur().ms) {
    toGuess();
  }
  draw();
  return phase === "ready" || phase === "show";
});
// The flash pauses with the tab: hidden time never counts (rule 7).
document.addEventListener("visibilitychange", () => (last = 0));

function setStatus() {
  const n = state.guesses.length;
  status.textContent = `#${today} · round ${Math.min(round + 1, S.ROUNDS)}/${S.ROUNDS}` + (n ? ` · ${S.score(state)}% off so far` : "");
}

function beginRound() {
  phase = "ready";
  clock = 0;
  last = 0;
  feedback.hidden = true;
  form.hidden = true;
  setStatus();
  if (resumeSeen) {
    resumeSeen = false;
    toGuess();
    return;
  }
  announce(`round ${round + 1} of ${S.ROUNDS}. dots appear in a moment.`);
  frame();
}

function toGuess() {
  phase = "guess";
  clock = 0;
  input.value = "";
  form.hidden = false;
  input.focus({ preventScroll: true });
  announce("how many dots were there? type a number.");
  draw();
}

function start() {
  if (phase !== "intro") return;
  intro.hidden = true;
  bringIntoView(document.querySelector(".hm-board"));
  tone("start");
  beginRound();
}

function submit(e) {
  e.preventDefault();
  if (phase !== "guess") return;
  const g = S.parseGuess(input.value);
  if (g == null) {
    input.setAttribute("aria-invalid", "true");
    $("guessHint").textContent = "a whole number, 1 to 9999";
    return;
  }
  input.removeAttribute("aria-invalid");
  $("guessHint").textContent = "";
  state = S.step(state, { guess: g });
  saveProgress();
  const n = cur().n;
  const gr = S.grade(g, n);
  tone(gr === 2 ? "good" : gr === 1 ? "tick" : "bad");
  phase = "answered";
  form.hidden = true;
  input.blur();
  const lastRound = round === S.ROUNDS - 1;
  const next = h("button", { type: "button", class: "btn", onclick: advance }, lastRound ? "see result " : "next cloud ", h("kbd", {}, "⏎"));
  const line = S.roundLine(g, n);
  feedback.replaceChildren(h("p", { class: "feedback__line" }, S.SQUARE[gr] + " ", line), next);
  feedback.hidden = false;
  setStatus();
  announce(line);
  draw();
  next.focus({ preventScroll: true });
}

function advance() {
  if (phase !== "answered") return;
  if (round < S.ROUNDS - 1) {
    round++;
    beginRound();
  } else finish();
}

function finish() {
  const res = saveResult();
  tone("finish");
  showEnd(res);
}

function history() {
  const r = results();
  const best = db.get("best", null);
  return h(
    "div",
    { class: "end__extra" },
    h("p", { class: "end__meta" }, `streak ${streak(r, today)}`, best != null ? ` · best ${best}% off` : ""),
    dailyHistory(r, today, (res) => (res.pct <= 10 ? 2 : res.pct <= 25 ? 1 : 0), (res) => res.label),
  );
}

function showEnd(res) {
  phase = "end";
  document.querySelector(".hm-board").hidden = true;
  feedback.hidden = true;
  const grades = res.g.map((g, i) => S.grade(g, res.n[i]));
  const text = S.shareText(today, res.pct, grades);
  const doShare = async (say) => say(shareLabel[await share(text)] || "");
  renderEnd(endEl, {
    title: `how many? #${today}`,
    lines: [
      h("span", {}, h("strong", { class: "accent" }, `${res.pct}% off`), ` · ${S.tier(res.pct)}`),
      h("span", { class: "squares", "aria-label": grades.map((g) => ["far", "close", "very close"][g]).join(", ") }, grades.map((g) => S.SQUARE[g]).join(" ")),
      h("span", { class: "muted hm-pairs" }, res.g.map((g, i) => `${g}→${res.n[i]}`).join("  ·  ")),
    ],
    primary: { copy: ">> share today's result", onClick: doShare },
    again: null,
    secondary: [followItem, anotherItem, { label: "read the blog", href: "../blog.html" }],
    extra: [dailyClock(today, "how-many.html"), history()],
  });
  status.textContent = `#${today} · done · ${res.pct}% off`;
  announce(`finished. on average ${res.pct} percent off. ${S.tier(res.pct)}.`);
}

// ---------- input ----------
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest("a, input, textarea, select")) return;
  const k = e.key;
  if (phase === "intro" && (k === "Enter" || k === " ")) {
    e.preventDefault();
    start();
  } else if (phase === "answered" && (k === "Enter" || k === " ")) {
    e.preventDefault();
    advance();
  }
});
$("start").addEventListener("click", start);
form.addEventListener("submit", submit);
new ResizeObserver(resize).observe(stage);

// ---------- boot ----------
mountGamePage(S.SLUG);
$("puzzleNo").textContent = "#" + today;
const done = results()[today];
const prog = db.get("progress", null);
if (done) {
  showEnd(done);
} else {
  if (prog && prog.puzzle === today && Array.isArray(prog.g)) {
    // Resume mid-puzzle: guessed clouds stay guessed, never re-shown.
    state = { ...state, guesses: prog.g.slice(0, S.ROUNDS) };
    round = state.guesses.length;
    resumeSeen = prog.seen === round;
    if (round || resumeSeen) $("introLine").textContent = resumeSeen ? `#${today} · cloud ${round + 1} already flashed: straight to your guess` : `#${today} · resume at cloud ${round + 1}/${S.ROUNDS}`;
    if (round >= S.ROUNDS) finish();
  }
  setStatus();
  resize();
}
