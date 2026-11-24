// reflex: input, timing and flow. Rules live in sim.js.
// The stage is a plain DOM box (no canvas): its colour is the whole game.

import * as S from "./sim.js";
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
const NEXT_MS = 900;
const EARLY_MS = 1200;

const challenge = fromLocation();
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
let seed = challenge ? challenge.seed : newSeed();
let state = S.create(seed);
// idle → wait → go → shown → wait … → end. "early" after a false start,
// "paused" after the tab was hidden mid-wait.
let phase = "idle";
let timer = 0;
let goAt = 0;

const stage = $("stage"), big = $("big"), small = $("small"), status = $("status"), times = $("times"), endEl = $("end");

// ---------- persistence ----------
const runs = () => db.get("runs", []);
function saveRun(ms) {
  const d = new Date().toISOString().slice(0, 10);
  const list = [...runs(), { m: ms, d }].sort((a, b) => a.m - b.m).slice(0, 5);
  db.set("runs", list);
  db.set("lastPlayed", puzzleNumber());
  return list;
}

// ---------- view ----------
function show(kind, bigText, smallText) {
  stage.dataset.state = kind;
  big.textContent = bigText;
  small.textContent = smallText;
}

function paintTimes() {
  const kids = [];
  for (let i = 0; i < S.ROUNDS; i++) {
    const t = state.times[i];
    kids.push(h("li", { class: t ? "is-done" : null }, t ? `${t} ms` : "—"));
  }
  times.replaceChildren(...kids);
  const best = runs()[0];
  status.textContent = `round ${Math.min(state.times.length + 1, S.ROUNDS)}/${S.ROUNDS}` + (state.falseStarts ? ` · ${state.falseStarts} false start${state.falseStarts > 1 ? "s" : ""}` : "") + (best ? ` · best avg ${best.m} ms` : "");
}

// ---------- flow ----------
function arm() {
  clearTimeout(timer);
  phase = "wait";
  show("wait", "wait for green…", "don't tap yet");
  timer = setTimeout(go, S.nextWait(state));
}

function go() {
  requestAnimationFrame(() => {
    if (phase !== "wait") return;
    phase = "go";
    show("go", "tap!", "");
    // Measured from the frame the colour changes in.
    goAt = performance.now();
    tone("tick");
    announce("tap now");
  });
}

function hit(t) {
  if (phase === "idle") return start();
  if (phase === "paused") return arm();
  if (phase === "wait") {
    clearTimeout(timer);
    state = S.step(state, { early: true });
    phase = "early";
    tone("bad");
    show("early", "too soon!", "wait for the green. this round starts over.");
    announce("too soon. this round starts over.");
    paintTimes();
    timer = setTimeout(arm, EARLY_MS);
    return;
  }
  if (phase !== "go") return;
  const ms = t - goAt;
  state = S.step(state, { ms });
  paintTimes();
  if (state.result === "early") {
    phase = "early";
    tone("bad");
    show("early", "too quick to be real", "that was a guess. this round starts over.");
    timer = setTimeout(arm, EARLY_MS);
    return;
  }
  if (state.result === "slow") {
    phase = "early";
    show("early", "missed it", "this round starts over.");
    timer = setTimeout(arm, EARLY_MS);
    return;
  }
  tone("good");
  const r = state.times[state.times.length - 1];
  if (S.isOver(state)) return finish();
  phase = "shown";
  show("shown", `${r} ms`, "next one in a moment…");
  announce(`${r} milliseconds`);
  timer = setTimeout(arm, NEXT_MS);
}

function start() {
  if (phase !== "idle") return;
  bringIntoView(stage);
  tone("start");
  paintTimes();
  arm();
}

function reset(newCourse) {
  clearTimeout(timer);
  if (newCourse && !challenge) seed = newSeed();
  state = S.create(seed);
  phase = "idle";
  endEl.hidden = true;
  paintTimes();
  start();
}

function finish() {
  clearTimeout(timer);
  phase = "end";
  const ms = S.score(state);
  const list = saveRun(ms);
  tone("finish");
  show("done", `${ms} ms`, "average of 5 · tap or press ⏎ to go again");
  const link = `markovstate.sh/play/reflex.html?c=${encode(seed, ms)}`;
  const lines = [
    h("span", {}, h("strong", { class: "accent" }, `${ms} ms`), ` · ${S.tier(ms)}`),
    h("span", { class: "muted" }, `fastest ${S.best(state)} ms` + (state.falseStarts ? ` · ${state.falseStarts} false start${state.falseStarts > 1 ? "s" : ""}` : " · no false starts") + " · a blink takes 100–400 ms"),
  ];
  if (challenge) {
    const diff = challenge.score - ms;
    lines.push(diff > 0 ? h("span", { class: "accent" }, `you won by ${diff} ms.`) : diff === 0 ? h("span", {}, "dead level. rematch?") : h("span", { class: "muted" }, `slower by ${-diff} ms. try again.`));
  }
  const doShare = async (say) => say(shareLabel[await share(S.shareText(ms, link))] || "");
  renderEnd(endEl, {
    title: challenge ? "reflex · challenge" : "reflex",
    lines,
    primary: { copy: challenge ? ">> send your own challenge back" : game.cta.copy, onClick: doShare },
    again: () => reset(true),
    secondary: [followItem, anotherItem, { label: "read the blog", href: game.post.href }],
    extra: [h("div", { class: "end__extra" }, h("p", { class: "end__meta" }, "your best averages on this device"), h("ol", { class: "top5" }, list.map((r) => h("li", { class: r.m === ms ? "is-this" : null }, h("span", {}, `${r.m} ms`), h("span", { class: "muted" }, r.d)))))],
  });
  setTimeout(() => phase === "end" && bringIntoView(endEl), 900);
  announce(`done. average ${ms} milliseconds. ${S.tier(ms)}.`);
  paintTimes();
}

// ---------- input ----------
stage.addEventListener("pointerdown", (e) => {
  if (e.button > 0) return;
  e.preventDefault();
  if (phase === "end") return reset(true);
  hit(e.timeStamp);
});
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (e.target.closest && e.target.closest("a, button, input, textarea, select")) return;
  if (e.key !== " " && e.key !== "Enter") return;
  e.preventDefault();
  if (phase === "end") return reset(true);
  hit(e.timeStamp);
});
// A hidden tab can't see green: abandon the current wait; the next tap re-arms.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && (phase === "wait" || phase === "go")) {
    clearTimeout(timer);
    phase = "paused";
    show("early", "paused", "tap to carry on");
  }
});

// ---------- boot ----------
mountGamePage(S.SLUG);
if (challenge) {
  const b = $("banner");
  b.textContent = `>> beat ${challenge.score} ms`;
  b.hidden = false;
}
paintTimes();
