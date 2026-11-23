// Shared, page-agnostic behaviour: the one reveal system, border illumination,
// and the page-level HUD. Loaded as a module on every page.

import { finePointer, STAGGER } from "./tokens.js";
import { mountHud, pageStates } from "./hud.js";

window.__motion = true;
document.documentElement.classList.add("js");

// ------------------------------------------------------------- reveals
// One-shot. Elements enter in reading order; siblings stagger via --i.
export function observeReveals(root = document) {
  const els = [...root.querySelectorAll(".reveal:not(.is-in)")];
  if (!("IntersectionObserver" in window)) {
    els.forEach((e) => e.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries
        .filter((en) => en.isIntersecting)
        .forEach((en) => {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  els.forEach((e) => io.observe(e));
}

// Stagger a list of freshly rendered children once.
export function staggerIn(children) {
  [...children].forEach((c, i) => {
    c.classList.add("reveal");
    c.style.setProperty("--i", i);
    // Make sure the start state is painted before flipping.
    requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add("is-in")));
  });
  return STAGGER * children.length;
}

// ------------------------------------------------- border illumination
if (finePointer()) {
  document.addEventListener(
    "pointermove",
    (e) => {
      const g = e.target.closest && e.target.closest(".glow");
      if (!g) return;
      const r = g.getBoundingClientRect();
      g.style.setProperty("--mx", e.clientX - r.left + "px");
      g.style.setProperty("--my", e.clientY - r.top + "px");
    },
    { passive: true }
  );
}

// ----------------------------------------------------------------- HUD
// Pages other than home declare <body data-page="blog|work|about|post">.
const page = document.body.dataset.page;
const host = document.getElementById("hud");
if (page && host && page !== "home") {
  const prefix = page === "post" ? "../" : "";
  mountHud(host, {
    states: pageStates(prefix),
    current: page === "post" ? "blog" : page,
    ambient: page !== "post", // no ambient motion on reading pages
    title: "~/states",
  });
}

observeReveals();
