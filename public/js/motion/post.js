// Post pages. Motion frames the reading and never touches it:
//   - generative header (animates once, then still)
//   - reading progress: a thin mint chain with a node per h2
//   - demo videos: lazy, play muted only when ≥ 50% visible
// No ambient motion in the body.

import "./site.js";
import { mountPostHeader, slugOf } from "./post-header.js";
import { reducedMotion } from "./tokens.js";

const reduce = reducedMotion();

// --------------------------------------------------------------- header
/* global blogPosts */
const slug = slugOf(location.pathname);
const post =
  typeof blogPosts !== "undefined" ? blogPosts.find((p) => slugOf(p.file) === slug) : null;
const headerHost = document.querySelector(".post-header");
if (headerHost) {
  // Unlisted posts still get a header, from the slug alone.
  mountPostHeader(headerHost, post || { file: slug + ".html", category: "" });
}

// ------------------------------------------------------- reading chain
const article = document.querySelector(".post-content") || document.querySelector("article");
const heads = article ? [...article.querySelectorAll("h2")] : [];
if (article) {
  const chain = document.createElement("div");
  chain.className = "read-chain";
  chain.setAttribute("aria-hidden", "true");
  chain.innerHTML = '<div class="read-chain__track"></div><div class="read-chain__fill"></div>';
  const nodes = heads.map((h, i) => {
    if (!h.id) h.id = "s-" + (i + 1) + "-" + h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
    const n = document.createElement("a");
    n.className = "read-chain__node";
    n.href = "#" + h.id;
    n.tabIndex = -1;
    n.title = h.textContent.trim();
    chain.appendChild(n);
    return n;
  });
  document.body.appendChild(chain);

  let start = 0, end = 1, marks = [], passed = -1, ticking = false;
  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  const measure = () => {
    start = docTop(article) - window.innerHeight * 0.2;
    end = docTop(article) + article.offsetHeight - window.innerHeight * 0.8;
    marks = heads.map((h) => (docTop(h) - window.innerHeight * 0.2 - start) / Math.max(1, end - start));
    nodes.forEach((n, i) => (n.style.left = Math.min(99.5, Math.max(0.5, marks[i] * 100)) + "%"));
    update();
  };
  const update = () => {
    ticking = false;
    const p = Math.min(1, Math.max(0, (window.scrollY - start) / Math.max(1, end - start)));
    chain.style.setProperty("--p", p.toFixed(4));
    let k = -1;
    marks.forEach((m, i) => { if (p >= m - 0.002) k = i; });
    if (k !== passed) {
      passed = k;
      nodes.forEach((n, i) => n.classList.toggle("is-passed", i <= k));
    }
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  if (document.fonts) document.fonts.ready.then(measure);
  measure();
}

// ---------------------------------------------------------- image fade
// Diagrams fade in once when decoded. Text is never animated.
document.querySelectorAll('.post-content img[loading="lazy"]').forEach((img) => {
  const done = () => img.classList.add("is-loaded");
  if (reduce || (img.complete && img.naturalWidth)) done();
  else {
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  }
});

// ---------------------------------------------------------------- videos
// <video data-autoplay preload="none" poster="…"> is played muted and inline
// only while at least half visible, and paused otherwise.
// Posters load only as a video approaches the viewport: a poster attribute
// downloads eagerly even with preload="none", and seven of them compete with
// the page's fonts. Width/height attributes keep the box size, so no shift.
const posted = [...document.querySelectorAll("video[data-poster]")];
const setPoster = (v) => { v.poster = v.dataset.poster; v.removeAttribute("data-poster"); };
if ("IntersectionObserver" in window) {
  const pio = new IntersectionObserver(
    (entries) => entries.forEach((en) => { if (en.isIntersecting) { setPoster(en.target); pio.unobserve(en.target); } }),
    { rootMargin: "600px 0px" }
  );
  posted.forEach((v) => pio.observe(v));
} else posted.forEach(setPoster);

const vids = [...document.querySelectorAll("video[data-autoplay]")];
if (reduce) {
  vids.forEach((v) => (v.controls = true));
} else if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        const v = en.target;
        if (en.intersectionRatio >= 0.5) {
          v.muted = true;
          v.playsInline = true;
          v.loop = true;
          const p = v.play();
          if (p && p.catch) p.catch(() => (v.controls = true));
        } else if (!v.paused) v.pause();
      }),
    { threshold: [0, 0.5] }
  );
  vids.forEach((v) => io.observe(v));
}
