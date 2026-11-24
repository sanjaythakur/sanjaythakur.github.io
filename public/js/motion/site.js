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

// ----------------------------------------------------------- crosshair
// Restrained crosshair, desktop + fine pointer only, and only over the
// interactive scenes. Elsewhere the native cursor is untouched.
const XH_REGIONS = ".state.origin, .state.edge, .hud";
const XH_LINKS = "a, button, [role='button'], [tabindex]:not([tabindex='-1'])";
function mountCrosshair() {
  const el = document.createElement("div");
  el.className = "xhair";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<span class="h"></span><span class="v"></span>';
  document.body.appendChild(el);
  document.querySelectorAll(XH_REGIONS).forEach((r) => r.classList.add("xh-region"));

  let x = 0, y = 0, queued = false, region = null;
  const paint = () => {
    queued = false;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const setRegion = (r) => {
    if (r === region) return;
    region?.classList.remove("xh-live");
    region = r;
    region?.classList.add("xh-live");
    if (r) paint();
    el.classList.toggle("is-on", !!r);
  };
  document.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return setRegion(null);
      x = e.clientX;
      y = e.clientY;
      const t = e.target.closest ? e.target : null;
      setRegion(t && t.closest(XH_REGIONS));
      el.classList.toggle("is-link", !!(region && t.closest(XH_LINKS)));
      if (!queued) {
        queued = true;
        requestAnimationFrame(paint);
      }
    },
    { passive: true }
  );
  document.documentElement.addEventListener("pointerleave", () => setRegion(null));
  window.addEventListener("blur", () => setRegion(null));
}
if (finePointer()) mountCrosshair();

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
