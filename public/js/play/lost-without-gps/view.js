// lost-without-gps: rendering, input and flow. Rules live in sim.js.

import { fitCanvas, loop, reducedMotion, mint, grey, easeOut } from "../../motion/tokens.js";
import * as G from "./sim.js";
import { puzzleNumber, streak } from "../daily.js";
import { store } from "../storage.js";
import { tone } from "../audio.js";
import { bySlug } from "../games.js";
import { h, mountGamePage, renderEnd, announce, shareItem, followItem, anotherItem, dailyClock, dailyHistory, bringIntoView } from "../shell.js";

const game = bySlug(G.SLUG);
const db = store(G.SLUG);
const $ = (id) => document.getElementById(id);
const REVEAL_TURN_MS = 520;
const BAD = "rgba(255,138,122,";

const today = puzzleNumber();
let state = G.create(today);
let phase = "intro"; // intro → guess → reveal → end
let reticle = null; // [x, y] metres
let turnShownAt = 0;
let revealAt = 0;

const canvas = $("map"), stage = $("stage"), status = $("status"), endEl = $("end");
const lock = $("lock"), intro = $("intro"), legend = $("legend"), readout = $("readout");
let ctx, cw, ch, view; // view: world → screen transform

// ---------- persistence ----------
const results = () => db.get("results", {});
function saveResult() {
  const err = G.score(state), filt = G.filterScore(state), beat = G.beats(state);
  const r = results();
  const res = { err, filt, beat, g: state.guesses.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]), label: `${err.toFixed(1)} m` };
  r[today] = res;
  db.set("results", r);
  db.set("progress", null);
  const best = db.get("best", null);
  if (best === null || err < best) db.set("best", err);
  // Returned, not re-read: storage may be unavailable.
  return res;
}

// ---------- geometry ----------
function layout() {
  ({ ctx, w: cw, h: ch } = fitCanvas(canvas));
  const pad = cw < 500 ? 2 : 10;
  const s = Math.min((cw - pad * 2) / G.W, (ch - pad * 2) / G.H);
  view = { s, ox: (cw - G.W * s) / 2, oy: (ch - G.H * s) / 2 };
}
const sx = (x) => view.ox + x * view.s;
const sy = (y) => view.oy + y * view.s;
const toWorld = (px, py) => [(px - view.ox) / view.s, (py - view.oy) / view.s];

// ---------- drawing ----------
function grid() {
  ctx.fillStyle = "#070807";
  ctx.fillRect(sx(0), sy(0), G.W * view.s, G.H * view.s);
  ctx.lineWidth = 1;
  for (let x = 0; x <= G.W; x += 5) {
    ctx.strokeStyle = grey(x % 10 ? 0.035 : 0.07);
    ctx.beginPath();
    ctx.moveTo(sx(x) + 0.5, sy(0));
    ctx.lineTo(sx(x) + 0.5, sy(G.H));
    ctx.stroke();
  }
  for (let y = 0; y <= G.H; y += 5) {
    ctx.strokeStyle = grey(y % 10 ? 0.035 : 0.07);
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(y) + 0.5);
    ctx.lineTo(sx(G.W), sy(y) + 0.5);
    ctx.stroke();
  }
  // Scale bar: 10 m.
  ctx.strokeStyle = grey(0.5);
  ctx.beginPath();
  ctx.moveTo(sx(1.5), sy(G.H - 1.5));
  ctx.lineTo(sx(11.5), sy(G.H - 1.5));
  ctx.stroke();
  ctx.fillStyle = grey(0.5);
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("10 m", sx(1.5), sy(G.H - 1.9));
}

function anchorsAndRings(t, alpha) {
  const { ranges } = state.turns[t];
  state.anchors.forEach(([ax, ay], i) => {
    const m = ranges[i];
    if (m) {
      // The band is ±1σ of range noise; the line is the measured range.
      ctx.strokeStyle = mint(0.1 * alpha);
      ctx.lineWidth = Math.max(2, 2 * G.RANGE_SIGMA * view.s);
      ctx.beginPath();
      ctx.arc(sx(ax), sy(ay), m.d * view.s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = mint(0.7 * alpha);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    const live = !!m;
    ctx.fillStyle = live ? "#f2f2f2" : grey(0.3);
    ctx.fillRect(sx(ax) - 5, sy(ay) - 5, 10, 10);
    ctx.fillStyle = live ? grey(0.85) : grey(0.4);
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textBaseline = "middle";
    label(live ? `uwb ${i + 1}` : `uwb ${i + 1} · no signal`, ax, ay);
  });
}

function cross(x, y, r, color, lw = 1.6) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(sx(x) - r, sy(y) - r);
  ctx.lineTo(sx(x) + r, sy(y) + r);
  ctx.moveTo(sx(x) + r, sy(y) - r);
  ctx.lineTo(sx(x) - r, sy(y) + r);
  ctx.stroke();
}

function polyline(pts, color, lw, dash = []) {
  if (pts.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
  ctx.stroke();
  ctx.setLineDash([]);
}

function startFix() {
  const [x, y] = state.truth[0];
  ctx.strokeStyle = grey(0.8);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(sx(x), sy(y), 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = grey(0.6);
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.textBaseline = "middle";
  label("last gps fix", x, y, 10);
}

// Where the IMU says the vehicle went this turn, from your last guess.
const imuFrom = () => (state.guesses.length ? state.guesses[state.guesses.length - 1] : state.truth[0]);
function imuArrow(t) {
  const [x0, y0] = imuFrom();
  const [dx, dy] = state.turns[t].imu;
  const x1 = x0 + dx, y1 = y0 + dy;
  ctx.strokeStyle = grey(0.55);
  ctx.lineWidth = 1.4;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sx(x0), sy(y0));
  ctx.lineTo(sx(x1), sy(y1));
  ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(sy(y1) - sy(y0), sx(x1) - sx(x0));
  ctx.fillStyle = grey(0.55);
  ctx.beginPath();
  ctx.moveTo(sx(x1), sy(y1));
  ctx.lineTo(sx(x1) - Math.cos(a - 0.45) * 9, sy(y1) - Math.sin(a - 0.45) * 9);
  ctx.lineTo(sx(x1) - Math.cos(a + 0.45) * 9, sy(y1) - Math.sin(a + 0.45) * 9);
  ctx.closePath();
  ctx.fill();
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("imu", sx(x1) + 6, sy(y1) + 4);
}

function reticleMark() {
  if (!reticle) return;
  const [x, y] = reticle;
  ctx.strokeStyle = mint(1);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(sx(x), sy(y), 9, 0, Math.PI * 2);
  ctx.moveTo(sx(x) - 15, sy(y));
  ctx.lineTo(sx(x) - 4, sy(y));
  ctx.moveTo(sx(x) + 4, sy(y));
  ctx.lineTo(sx(x) + 15, sy(y));
  ctx.moveTo(sx(x), sy(y) - 15);
  ctx.lineTo(sx(x), sy(y) - 4);
  ctx.moveTo(sx(x), sy(y) + 4);
  ctx.lineTo(sx(x), sy(y) + 15);
  ctx.stroke();
}

function cloud(t, alpha) {
  const c = state.filter.clouds[t];
  let mx = 0;
  for (let i = 0; i < c.w.length; i++) if (c.w[i] > mx) mx = c.w[i];
  for (let i = 0; i < c.w.length; i++) {
    const a = (0.15 + 0.85 * (c.w[i] / mx)) * alpha;
    if (a < 0.03) continue;
    ctx.fillStyle = mint(a * 0.8);
    ctx.fillRect(sx(c.x[i]) - 1.2, sy(c.y[i]) - 1.2, 2.4, 2.4);
  }
}

function drawGuessing(now) {
  const t = G.turn(state);
  const fade = reducedMotion() ? 1 : easeOut((now - turnShownAt) / 420);
  grid();
  polyline([state.truth[0], ...state.guesses], grey(0.25), 1, [2, 4]);
  startFix();
  state.guesses.forEach(([x, y]) => cross(x, y, 4, grey(0.55), 1.3));
  anchorsAndRings(t, fade);
  imuArrow(t);
  reticleMark();
  return fade < 1;
}

// Reveal: the cloud replays turn by turn, collapsing onto the truth.
function drawReveal(now) {
  const total = G.TURNS * REVEAL_TURN_MS;
  const p = reducedMotion() || phase === "end" ? total : Math.min(total, now - revealAt);
  const k = Math.min(G.TURNS - 1, Math.floor(p / REVEAL_TURN_MS));
  const f = (p - k * REVEAL_TURN_MS) / REVEAL_TURN_MS;
  const upto = (arr, n) => arr.slice(0, n);
  grid();
  state.anchors.forEach(([ax, ay], i) => {
    ctx.fillStyle = grey(0.6);
    ctx.fillRect(sx(ax) - 4, sy(ay) - 4, 8, 8);
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textBaseline = "middle";
    label(`uwb ${i + 1}`, ax, ay, 8);
  });
  cloud(k, p >= total ? 0.7 : 1 - 0.3 * f);
  const n = k + 2; // truth includes the start
  polyline(upto(state.truth, n), "#f2f2f2", 2);
  polyline(upto([state.truth[0], ...state.filter.est], n), mint(0.95), 1.6, [5, 4]);
  polyline(upto([state.truth[0], ...state.guesses], n), BAD + "0.55)", 1.2);
  const errs = G.errors(state), ferrs = G.filterErrors(state);
  for (let i = 0; i <= k; i++) {
    const [gx, gy] = state.guesses[i];
    cross(gx, gy, 4.5, errs[i] < ferrs[i] ? mint(1) : BAD + "0.95)", 1.8);
    const [tx, ty] = state.truth[i + 1];
    ctx.fillStyle = "#f2f2f2";
    ctx.beginPath();
    ctx.arc(sx(tx), sy(ty), 3, 0, Math.PI * 2);
    ctx.fill();
    const [fx, fy] = state.filter.est[i];
    ctx.strokeStyle = mint(1);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(sx(fx), sy(fy), 3.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  startFix();
  if (p < total) return true;
  if (phase === "reveal") finish();
  return false;
}

function draw(now) {
  if (!ctx) return false;
  ctx.clearRect(0, 0, cw, ch);
  // Nothing (rings, labels, clouds) draws outside the map.
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx(0), sy(0), G.W * view.s, G.H * view.s);
  ctx.clip();
  let more = false;
  if (phase === "intro") {
    grid();
    startFix();
    anchorsAndRings(0, 0.35);
  } else if (phase === "guess") more = drawGuessing(now);
  else more = drawReveal(now);
  ctx.restore();
  return more;
}

// Labels near the right edge of the map flip to the left of their point.
function label(text, x, y, dx = 9) {
  const right = sx(x) + dx + ctx.measureText(text).width > sx(G.W) - 4;
  ctx.textAlign = right ? "right" : "left";
  ctx.fillText(text, right ? sx(x) - dx : sx(x) + dx, sy(y));
}
const kick = loop(draw);
const redraw = () => draw(performance.now()) && kick();

// ---------- flow ----------
function setStatus() {
  if (phase === "end") return;
  const t = G.turn(state);
  const missing = state.turns[Math.min(t, G.TURNS - 1)].ranges.some((m) => !m);
  status.textContent = `#${today} · turn ${Math.min(t + 1, G.TURNS)}/${G.TURNS}${missing && phase === "guess" ? " · one anchor lost" : ""}`;
}

function beginTurn() {
  const t = G.turn(state);
  // Start the reticle where the IMU says: a fair default, rarely the answer.
  const [x0, y0] = imuFrom();
  const [dx, dy] = state.turns[t].imu;
  reticle = [x0 + dx, y0 + dy];
  turnShownAt = performance.now();
  setStatus();
  const lost = state.turns[t].ranges.findIndex((m) => !m);
  announce(`turn ${t + 1} of ${G.TURNS}. ${lost >= 0 ? `anchor ${lost + 1} has no signal. ` : ""}place your guess, then lock it in.`);
  updateReadout();
  redraw();
}

function start() {
  if (phase !== "intro") return;
  phase = "guess";
  intro.hidden = true;
  lock.hidden = false;
  bringIntoView(stage);
  tone("start");
  beginTurn();
}

function updateReadout() {
  if (!reticle) return;
  readout.textContent = `guess: ${reticle[0].toFixed(1)} m east, ${(G.H - reticle[1]).toFixed(1)} m north`;
}

function confirm() {
  if (phase !== "guess" || !reticle) return;
  state = G.step(state, { x: reticle[0], y: reticle[1] });
  tone("tick");
  db.set("progress", { puzzle: today, g: state.guesses });
  if (G.isOver(state)) {
    phase = "reveal";
    lock.hidden = true;
    reticle = null;
    revealAt = performance.now();
    status.textContent = `#${today} · revealing…`;
    announce("all eight guesses in. revealing the true path and the filter.");
    redraw();
  } else beginTurn();
}

function finish() {
  phase = "end";
  const res = saveResult();
  tone("finish");
  showEnd(res);
}

function showEnd(res) {
  phase = "end";
  lock.hidden = true;
  intro.hidden = true;
  legend.hidden = false;
  readout.hidden = true;
  redraw();
  const all = res.beat === G.TURNS;
  const beatLine = all
    ? h("span", { class: "accent" }, `beat the filter ${G.TURNS}/${G.TURNS}. you are the filter now. we should definitely talk.`)
    : res.beat > 0
      ? h("span", {}, `beat the filter ${res.beat}/${G.TURNS} `, h("span", { class: "accent" }, "★"))
      : h("span", { class: "muted" }, `the filter won all ${G.TURNS}. it's had practice.`);
  const r = results();
  const best = db.get("best", null);
  const grade = (x) => (x.err <= x.filt * 1.5 ? 2 : x.err <= x.filt * 3 ? 1 : 0);
  renderEnd(endEl, {
    title: `lost-without-gps #${today}`,
    lines: [h("span", {}, "you ", h("strong", { class: "accent" }, `${res.err.toFixed(1)} m`), ` · filter ${res.filt.toFixed(1)} m`), beatLine],
    primary: { copy: game.cta.copy, href: game.cta.href },
    secondary: [
      { label: "read: " + game.post.title.toLowerCase(), href: game.post.href },
      shareItem("share", () => G.shareText(today, res.err, res.beat)),
      followItem,
      anotherItem,
    ],
    extra: [
      h("div", { class: "explainer" }, h("p", { class: "end__title" }, "how the filter did it"), ...G.EXPLAINER.map((s) => h("p", {}, s))),
      dailyClock(today, "lost-without-gps.html"),
      h(
        "div",
        { class: "end__extra" },
        h("p", { class: "end__meta" }, `streak ${streak(r, today)}`, best !== null ? ` · best ${best.toFixed(1)} m` : ""),
        dailyHistory(r, today, grade, (x) => `${x.err.toFixed(1)} m`),
      ),
    ],
  });
  status.textContent = `#${today} · done · ${res.err.toFixed(1)} m`;
  announce(`finished. mean error ${res.err.toFixed(1)} metres. the filter averaged ${res.filt.toFixed(1)}. you beat it on ${res.beat} of ${G.TURNS} turns.`);
}

// ---------- input ----------
let dragging = false;
function place(e) {
  const r = canvas.getBoundingClientRect();
  const [x, y] = toWorld(e.clientX - r.left, e.clientY - r.top);
  reticle = [Math.min(G.W, Math.max(0, x)), Math.min(G.H, Math.max(0, y))];
  updateReadout();
  redraw();
}
canvas.addEventListener("pointerdown", (e) => {
  if (phase === "intro") return start();
  if (phase !== "guess") return;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  place(e);
});
canvas.addEventListener("pointermove", (e) => dragging && place(e));
canvas.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("pointercancel", () => (dragging = false));

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest && e.target.closest("a, input, textarea, select")) return;
  const k = e.key;
  if (phase === "intro" && (k === "Enter" || k === " ")) {
    e.preventDefault();
    start();
  } else if (phase === "guess") {
    if (ARROWS[k] && reticle) {
      e.preventDefault();
      const d = e.shiftKey ? 5 : 0.5;
      reticle = [Math.min(G.W, Math.max(0, reticle[0] + ARROWS[k][0] * d)), Math.min(G.H, Math.max(0, reticle[1] + ARROWS[k][1] * d))];
      updateReadout();
      redraw();
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      confirm();
    }
  }
});
$("start").addEventListener("click", start);
lock.addEventListener("click", confirm);
new ResizeObserver(() => {
  layout();
  redraw();
}).observe(stage);

// ---------- boot ----------
mountGamePage(G.SLUG);
$("puzzleNo").textContent = "#" + today;
const done = results()[today];
if (done) {
  state = { ...state, guesses: done.g };
  showEnd(done);
} else {
  const prog = db.get("progress", null);
  if (prog && prog.puzzle === today && prog.g && prog.g.length && prog.g.length < G.TURNS) {
    state = { ...state, guesses: prog.g };
    $("introLine").textContent = `#${today} · resume at turn ${prog.g.length + 1}/${G.TURNS}`;
  }
  setStatus();
}
