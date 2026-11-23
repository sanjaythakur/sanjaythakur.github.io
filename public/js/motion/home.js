// Homepage: the Markov chain s₀ → s_T.
// Each section is a state; scrolling is a transition; the particle field morphs.

import { observeReveals } from "./site.js";
import { mountHud } from "./hud.js";
import { createField } from "./field.js";
import { reducedMotion, isMobile } from "./tokens.js";
import { initBoot } from "./scenes/boot.js";
import { makeGlobe, heroKeyframe, journeyKeyframe } from "./scenes/planet.js";
import { edgeKeyframes } from "./scenes/edge.js";
import { proofKeyframe, countUp } from "./scenes/proof.js";
import { renderPosts, writingKeyframe } from "./scenes/writing.js";
import { terminalKeyframe } from "./scenes/terminal.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = reducedMotion();
const stacked = () => isMobile() || reduce;

// ------------------------------------------------------------- s₄ posts
const list = $("#postsList");
if (list && typeof getRecentPosts === "function") {
  // eslint-disable-next-line no-undef
  renderPosts(list, getRecentPosts(3));
  observeReveals(list);
}

// ------------------------------------------------------------------ HUD
const STATES = [
  { id: "s0", label: "s₀", sub: "boot", href: "#s0" },
  { id: "s1", label: "s₁", sub: "planet", href: "#s1" },
  { id: "s2", label: "s₂", sub: "edge", href: "#s2" },
  { id: "s3", label: "s₃", sub: "proof", href: "#s3" },
  { id: "s4", label: "s₄", sub: "writing", href: "#s4" },
  { id: "sT", label: "s_T", sub: "terminal", href: "#sT" },
];
const hud = mountHud($("#hud"), {
  states: STATES,
  current: "s0",
  ambient: true,
  absorbing: true,
  title: "~/markovstate",
});

// The current state is whichever section crosses the middle of the viewport.
const sections = $$("[data-state]");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && hud.set(en.target.dataset.state)),
    { rootMargin: "-50% 0px -50% 0px" }
  );
  sections.forEach((s) => io.observe(s));
}

// ---------------------------------------------------------- s₀ boot
let hero;
const booting = initBoot({
  skipButton: $("#skipIntro"),
  onSkip: () => {
    if (hero) hero.assembling = false;
  },
});

// ------------------------------------------------------ particle field
const canvas = $("#field");
let field = null;
if (canvas && canvas.getContext) {
  const lowPower =
    isMobile() || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const globe = makeGlobe(lowPower ? 3.4 : 2.35);
  const N = globe.n;

  hero = heroKeyframe({
    slotEl: $("#globeSlot"),
    cardEl: $("#globeCard"),
    cursorEl: $("#heroCursor"),
    booting: booting && !reduce,
  });
  const journey = journeyKeyframe({
    slotEl: $("#originSlot"),
    legendItems: $$(".stops li"),
    stacked,
  });
  const edge = edgeKeyframes({
    slotEls: $$(".beat__art"),
    pin: $(".edge__pin"),
    section: $("#s2"),
    stacked,
    N,
  });
  const proof = proofKeyframe({ baselineEl: $(".proof__baseline"), readoutEls: $$(".readout") });
  const writing = writingKeyframe({ listEl: list });
  const terminal = terminalKeyframe({ nodeEl: $(".terminal__node") });

  const beats = $$(".beat");
  const scripts = $(".scripts");
  let shownBeat = -1;

  field = createField(canvas, {
    n: N,
    globe,
    keyframes: [hero, journey, ...edge.keyframes, proof, writing, terminal],
    onFrame(env) {
      // Reads first; DOM writes only when something actually changes.
      const b = edge.isStacked() ? -1 : edge.activeBeat(env);
      const pending = scripts && !scripts.classList.contains("is-resolved");
      const sr = pending ? scripts.getBoundingClientRect() : null;
      if (b !== shownBeat) {
        shownBeat = b;
        beats.forEach((el, i) => el.classList.toggle("is-active", b === -1 || i === b));
      }
      if (sr && (edge.isStacked() ? sr.top < env.vh * 0.8 : b >= 1)) {
        scripts.classList.add("is-resolved");
      }
    },
  });
  if (field) {
    document.documentElement.classList.add("has-field");
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => field.layout());
  }
}

// ------------------------------------------------------------ s₃ proof
countUp($$(".readout__num"), reduce);

// ------------------------------------------------------- HUD jumps
// Anchor links scroll natively (smooth unless reduced motion). Move focus to
// the target section so keyboard users land where they jumped.
// Delegated, because the HUD rebuilds itself across breakpoints.
$("#hud").addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  const t = a && document.getElementById(a.getAttribute("href").slice(1));
  if (t) {
    t.setAttribute("tabindex", "-1");
    t.focus({ preventScroll: true });
  }
});
