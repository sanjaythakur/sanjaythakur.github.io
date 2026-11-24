// markovle: rendering, input and flow. Rules live in sim.js.

import { fitCanvas, loop, reducedMotion, easeInOut, mint } from "../../motion/tokens.js";
import * as S from "./sim.js";
import { drawChain, drawNode, nodePos, bend, qAt, loopCentre, describe, COLORS } from "./draw.js";
import { puzzleNumber, streak } from "../daily.js";
import { store } from "../storage.js";
import { tone } from "../audio.js";
import { bySlug } from "../games.js";
import { h, mountGamePage, renderEnd, announce, shareItem, followItem, anotherItem, dailyClock, dailyHistory } from "../shell.js";

const game = bySlug(S.SLUG);
const db = store(S.SLUG);
const $ = (id) => document.getElementById(id);
const HOP_MS = 300;

const today = puzzleNumber();
let state = S.create(today);
let round = 0;
let phase = "intro"; // intro → watch → answered → … → end
let startedAt = 0;
let elapsed = 0;
let playStart = 0; // trajectory playback clock
let answered = false;

const stage = $("stage"), trajCanvas = $("traj"), seq = $("seq"), choices = $("choices");
const feedback = $("feedback"), status = $("status"), endEl = $("end"), intro = $("intro");
let tctx, tw, th;
const choiceCanvases = [];

// ---------- persistence ----------
const results = () => db.get("results", {});
function saveProgress() {
  db.set("progress", { puzzle: today, picks: state.picks, ms: elapsed + (startedAt ? performance.now() - startedAt : 0) });
}
function saveResult() {
  const r = results();
  r[today] = { m: S.marks(state).map(Number), ms: Math.round(elapsed), label: `${S.score(state)}/${S.ROUNDS}` };
  db.set("results", r);
  db.set("progress", null);
  const best = db.get("best", null);
  const s = S.score(state);
  if (!best || s > best.s || (s === best.s && elapsed < best.ms)) db.set("best", { s, ms: Math.round(elapsed) });
}

// ---------- layout ----------
function box(w, hgt, pad) {
  return { x: pad, y: pad, w: w - pad * 2, h: hgt - pad * 2 };
}
const trajBox = () => {
  const s = Math.min(tw, th);
  const pad = s * 0.16;
  return { x: (tw - s) / 2 + pad, y: pad, w: s - pad * 2, h: s - pad * 2 };
};

function resize() {
  ({ ctx: tctx, w: tw, h: th } = fitCanvas(trajCanvas));
  choiceCanvases.forEach(drawChoice);
  drawTraj(performance.now());
}

// ---------- trajectory ----------
const cur = () => state.rounds[Math.min(round, S.ROUNDS - 1)];

function hopsShown(now) {
  if (reducedMotion() || phase !== "watch" || answered) return cur().traj.length - 1;
  // rAF timestamps can precede a performance.now() taken in the same frame.
  return Math.max(0, Math.min(cur().traj.length - 1, (now - playStart) / HOP_MS));
}

function drawTraj(now) {
  if (!tctx) return false;
  const { traj } = cur();
  const n = state.n;
  const b = trajBox();
  const r = Math.max(9, Math.min(16, b.w * 0.06));
  tctx.clearRect(0, 0, tw, th);
  const shown = phase === "intro" ? 0 : hopsShown(now);
  const k = Math.floor(shown);

  // Observed transitions so far, as faint accumulating strokes.
  for (let s = 1; s <= k; s++) {
    const a = traj[s - 1], z = traj[s];
    const age = (k - s) / Math.max(1, k);
    tctx.strokeStyle = mint(0.08 + 0.22 * (1 - age));
    tctx.lineWidth = 1.4;
    tctx.beginPath();
    if (a === z) {
      const c = loopCentre(n, a, b, r);
      tctx.arc(c.x, c.y, r * 0.95, 0, Math.PI * 2);
    } else {
      const p = nodePos(n, a, b), q = nodePos(n, z, b), c = bend(p, q);
      tctx.moveTo(p.x, p.y);
      tctx.quadraticCurveTo(c.x, c.y, q.x, q.y);
    }
    tctx.stroke();
  }

  // Nodes, the current one glowing.
  const at = traj[Math.min(k, traj.length - 1)];
  for (let i = 0; i < n; i++) {
    const p = nodePos(n, i, b);
    drawNode(tctx, i, p.x, p.y, r, { glow: phase !== "intro" && i === at ? 1 : 0 });
  }

  // The particle, in flight between hops.
  let moving = false;
  if (phase === "watch" && !answered && k < traj.length - 1 && !reducedMotion()) {
    moving = true;
    const f = easeInOut(shown - k);
    const a = traj[k], z = traj[k + 1];
    let pt;
    if (a === z) {
      const c = loopCentre(n, a, b, r);
      const p = nodePos(n, a, b);
      const base = Math.atan2(p.y - c.y, p.x - c.x);
      const ang = base + f * Math.PI * 2;
      pt = { x: c.x + Math.cos(ang) * r * 0.95, y: c.y + Math.sin(ang) * r * 0.95 };
    } else {
      const p = nodePos(n, a, b), q = nodePos(n, z, b);
      pt = qAt(p, bend(p, q), q, f);
    }
    tctx.save();
    tctx.shadowColor = "#59f3b0";
    tctx.shadowBlur = 14;
    tctx.fillStyle = "#f2f2f2";
    tctx.beginPath();
    tctx.arc(pt.x, pt.y, 3.6, 0, Math.PI * 2);
    tctx.fill();
    tctx.restore();
  }
  // Nothing about the trajectory is shown before the clock starts.
  if (phase === "intro") seq.replaceChildren();
  else paintSeq(k);
  if (moving && k !== lastHop) {
    lastHop = k;
    tone("hop", 330 + 110 * traj[k]);
  }
  return moving;
}
let lastHop = -1;

function paintSeq(k) {
  const { traj } = cur();
  if (seq.childElementCount !== traj.length) {
    seq.replaceChildren(
      ...traj.map((s) => {
        const sp = h("span", { class: "seq__s" }, "ABCD"[s]);
        sp.style.color = COLORS[s];
        return sp;
      }),
    );
    seq.setAttribute("aria-label", "trajectory: " + traj.map((s) => "ABCD"[s]).join(" "));
  }
  [...seq.children].forEach((sp, i) => {
    sp.classList.toggle("is-shown", i <= k);
    sp.classList.toggle("is-now", i === k);
  });
}

const kick = loop((now) => drawTraj(now));

// ---------- candidates ----------
function buildChoices() {
  choices.replaceChildren();
  choiceCanvases.length = 0;
  cur().candidates.forEach((P, i) => {
    const c = h("canvas", { "aria-hidden": "true" });
    const btn = h(
      "button",
      { type: "button", class: "choice", "data-i": i, "aria-label": `graph ${i + 1}: ${describe(P)}`, onclick: () => answer(i) },
      c,
      h("span", { class: "choice__key" }, String(i + 1)),
    );
    c._P = P;
    choiceCanvases.push(c);
    choices.append(btn);
  });
  requestAnimationFrame(() => choiceCanvases.forEach(drawChoice));
}

function drawChoice(c) {
  if (!c.clientWidth) return;
  const { ctx, w, h: hh } = fitCanvas(c);
  ctx.clearRect(0, 0, w, hh);
  const s = Math.min(w, hh);
  const pad = s * 0.2;
  const b = { x: (w - s) / 2 + pad, y: (hh - s) / 2 + pad, w: s - pad * 2, h: s - pad * 2 };
  drawChain(ctx, c._P, b, { r: Math.max(6, s * 0.065), scale: Math.max(0.6, s / 190) });
}

// ---------- flow ----------
function setStatus() {
  const m = S.marks(state);
  status.textContent = `#${today} · round ${Math.min(round + 1, S.ROUNDS)}/${S.ROUNDS} · ${m.filter(Boolean).length} right`;
}

function beginRound() {
  phase = "watch";
  answered = false;
  lastHop = -1;
  feedback.hidden = true;
  feedback.replaceChildren();
  seq.replaceChildren();
  buildChoices();
  setStatus();
  playStart = performance.now();
  announce(`round ${round + 1} of ${S.ROUNDS}. ${cur().traj.length} steps. pick the chain that made it.`);
  drawTraj(playStart);
  kick();
}

function start() {
  if (phase !== "intro") return;
  intro.hidden = true;
  stage.classList.add("is-live");
  startedAt = performance.now();
  tone("start");
  beginRound();
}

function replay() {
  if (phase !== "watch" || answered) return;
  playStart = performance.now();
  lastHop = -1;
  kick();
}

function answer(i) {
  if (phase !== "watch" || answered) return;
  answered = true;
  state = S.step(state, { pick: i });
  const rd = cur();
  const ok = i === rd.answer;
  tone(ok ? "good" : "bad");
  [...choices.children].forEach((btn, k) => {
    btn.disabled = true;
    btn.classList.toggle("is-right", k === rd.answer);
    btn.classList.toggle("is-wrong", k === i && !ok);
  });
  const line = S.intuition(rd, i);
  const last = round === S.ROUNDS - 1;
  const next = h("button", { type: "button", class: "btn", onclick: advance }, last ? "see result " : "next round ", h("kbd", {}, "⏎"));
  feedback.replaceChildren(h("p", { class: "feedback__line" }, h("span", { class: ok ? "accent" : "bad" }, ok ? "✓ " : "✕ "), line), next);
  feedback.hidden = false;
  setStatus();
  announce(line);
  drawTraj(performance.now());
  saveProgress();
  next.focus({ preventScroll: true });
}

function advance() {
  if (!answered) return;
  if (round < S.ROUNDS - 1) {
    round++;
    beginRound();
  } else finish();
}

function finish() {
  if (startedAt) elapsed += performance.now() - startedAt;
  startedAt = 0;
  phase = "end";
  saveResult();
  tone("finish");
  showEnd(results()[today]);
}

const fmtTime = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function history() {
  const r = results();
  const sum = (res) => res.m.reduce((a, b) => a + b, 0);
  const best = db.get("best", null);
  return h(
    "div",
    { class: "end__extra" },
    h("p", { class: "end__meta" }, `streak ${streak(r, today)}`, best ? ` · best ${best.s}/5 in ${fmtTime(best.ms)}` : ""),
    dailyHistory(r, today, (res) => (sum(res) >= 4 ? 2 : sum(res) >= 3 ? 1 : 0), (res) => sum(res) + "/5"),
  );
}

function showEnd(res) {
  phase = "end";
  document.querySelector(".board").hidden = true;
  feedback.hidden = true;
  const m = res.m.map(Boolean);
  const c = m.filter(Boolean).length;
  const clock = dailyClock(today, "markovle.html");
  renderEnd(endEl, {
    title: `markovle #${today}`,
    lines: [
      h("span", {}, h("strong", { class: "accent" }, `${c}/${S.ROUNDS}`), ` · ${S.tier(c)} · ${fmtTime(res.ms)}`),
      h("span", { class: "squares", "aria-label": m.map((ok) => (ok ? "right" : "wrong")).join(", ") }, m.map((ok) => (ok ? "🟩" : "🟥")).join(" ")),
    ],
    primary: { copy: game.cta.copy, href: game.cta.href },
    again: null,
    secondary: [shareItem("share", () => S.shareText(today, m)), followItem, anotherItem],
    extra: [clock, history()],
  });
  status.textContent = `#${today} · done · ${c}/${S.ROUNDS}`;
  announce(`finished. ${c} of ${S.ROUNDS} right. ${S.tier(c)}.`);
}

// ---------- input ----------
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest("a, input, textarea, select")) return;
  const k = e.key;
  if (phase === "intro" && (k === "Enter" || k === " ")) {
    e.preventDefault();
    start();
  } else if (phase === "watch") {
    if (!answered && k >= "1" && k <= "4") {
      e.preventDefault();
      answer(+k - 1);
    } else if (answered && (k === "Enter" || k === " ")) {
      e.preventDefault();
      advance();
    } else if (!answered && (k === "r" || k === "R")) replay();
  }
});
$("start").addEventListener("click", start);
$("replay").addEventListener("click", replay);
new ResizeObserver(resize).observe(stage);
new ResizeObserver(() => choiceCanvases.forEach(drawChoice)).observe(choices);

// ---------- boot ----------
mountGamePage(S.SLUG);
$("puzzleNo").textContent = "#" + today;
const done = results()[today];
const prog = db.get("progress", null);
if (done) {
  showEnd(done);
} else {
  if (prog && prog.puzzle === today && prog.picks.length) {
    // Resume mid-puzzle: answered rounds stay answered.
    state = { ...state, picks: prog.picks.slice(0, S.ROUNDS) };
    round = state.picks.length;
    elapsed = prog.ms || 0;
    $("introLine").textContent = `#${today} · resume at round ${round + 1}/${S.ROUNDS}`;
    if (round >= S.ROUNDS) finish();
  }
  setStatus();
  resize();
}
