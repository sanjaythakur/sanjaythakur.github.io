// State-graph HUD (SPEC §6.4).
// Inline SVG. Nodes are real links: Tab reaches them, Enter follows them.
// Desktop: vertical graph in the right margin. Mobile: thin progress chain.
// Transition probabilities are decorative, never data.

import { reducedMotion, isMobile, DUR } from "./tokens.js";

const NS = "http://www.w3.org/2000/svg";
const P = ["0.97", "0.91", "0.88", "0.94", "0.86", "0.90", "0.93"];

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};

/**
 * @param {HTMLElement} host   the static <nav class="hud"> placeholder
 * @param {object} o
 * @param {{id:string,label:string,sub?:string,href:string}[]} o.states
 * @param {string} o.current    id of the lit state
 * @param {boolean} [o.ambient] quiet pulse every 4–6 s once settled
 * @param {string} [o.title]
 * @param {boolean} [o.absorbing] draw a p=1.00 self-loop on the last state
 * @param {(id:string, e:Event)=>void} [o.onSelect]
 */
export function mountHud(host, o) {
  const states = o.states;
  let current = o.current;
  let mobile = isMobile();
  let svg, nodes = [], edges = [], probs = [], pulse, loopEdge, loopProb;
  let ambientTimer = 0;

  function build() {
    host.textContent = "";
    mobile = isMobile();
    const n = states.length;
    const compact = !mobile && window.innerWidth < 1560;
    const W = mobile ? Math.max(260, window.innerWidth) : compact ? 44 : 132;
    const gap = 46;
    const H = mobile ? 22 : 34 + (n - 1) * gap + 30;
    const pos = (i) =>
      mobile
        ? { x: 22 + (i * (W - 44)) / (n - 1), y: 11 }
        : { x: compact ? 22 : 14, y: 34 + i * gap };

    svg = el("svg", {
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: mobile ? "none" : "xMidYMid meet",
      role: "presentation",
    });
    if (mobile) svg.style.height = H + "px";
    if (o.title && !mobile) {
      const t = el("text", { x: 4, y: 10, class: "hud__title", "aria-hidden": "true" }, svg);
      t.textContent = o.title;
    }

    edges = [];
    probs = [];
    for (let i = 0; i < n - 1; i++) {
      const a = pos(i), b = pos(i + 1);
      const d = mobile
        ? `M${a.x + 5},${a.y} L${b.x - 5},${b.y}`
        : `M${a.x},${a.y + 5} C${a.x - 13},${a.y + 18} ${b.x - 13},${b.y - 18} ${b.x},${b.y - 5}`;
      const path = el("path", { d, class: "hud__edge", "aria-hidden": "true" }, svg);
      path.style.setProperty("--i", i);
      edges.push(path);
      if (!mobile) {
        const t = el("text", {
          x: a.x + 14, y: (a.y + b.y) / 2 + 3, class: "hud__p", "aria-hidden": "true",
        }, svg);
        t.textContent = "p=" + P[i % P.length];
        probs.push(t);
      }
    }
    loopEdge = loopProb = null;
    if (o.absorbing && !mobile) {
      const z = pos(n - 1);
      loopEdge = el("path", {
        d: `M${z.x - 4},${z.y + 4} C${z.x - 18},${z.y + 26} ${z.x + 18},${z.y + 26} ${z.x + 4},${z.y + 4}`,
        class: "hud__edge", "aria-hidden": "true",
      }, svg);
      loopEdge.style.setProperty("--i", n - 1);
      loopProb = el("text", { x: z.x + 14, y: z.y + 22, class: "hud__p", "aria-hidden": "true" }, svg);
      loopProb.textContent = "p=1.00";
    }
    for (const p of [...edges, loopEdge].filter(Boolean)) {
      p.style.setProperty("--len", Math.ceil(p.getTotalLength()));
    }

    nodes = states.map((s, i) => {
      const { x, y } = pos(i);
      const a = el("a", {
        href: s.href,
        class: "hud__node",
        "aria-label": `state ${s.label}${s.sub ? ": " + s.sub : ""}`,
      }, svg);
      a.style.setProperty("--i", i);
      el("circle", { cx: x, cy: y, r: mobile ? 22 : 14, class: "hud__hit", fill: "transparent", stroke: "none" }, a);
      el("circle", { cx: x, cy: y, r: 8, class: "hud__ring" }, a);
      el("circle", { cx: x, cy: y, r: mobile ? 3.5 : 4, class: "hud__dot" }, a);
      const tt = el("title", {}, a);
      tt.textContent = s.label + (s.sub ? " " + s.sub : "");
      if (!mobile) {
        const t = el("text", { x: x + 14, y: y + 4 }, a);
        t.textContent = s.label;
        if (s.sub) {
          const ts = el("tspan", { class: "hud__sub" }, t);
          ts.textContent = " " + s.sub;
        }
      }
      const hot = (on) => {
        edges[i]?.classList.toggle("is-hot", on);
        probs[i]?.classList.toggle("is-hot", on);
        if (i === n - 1 && loopEdge) {
          loopEdge.classList.toggle("is-hot", on);
          loopProb.classList.toggle("is-hot", on);
        }
      };
      a.addEventListener("pointerenter", () => hot(true));
      a.addEventListener("pointerleave", () => hot(false));
      a.addEventListener("focus", () => hot(true));
      a.addEventListener("blur", () => hot(false));
      a.addEventListener("click", (e) => o.onSelect && o.onSelect(s.id, e));
      return a;
    });

    pulse = el("circle", { r: 2.5, cx: 0, cy: 0, class: "hud__pulse", "aria-hidden": "true" }, svg);
    host.appendChild(svg);
    paint();
  }

  function paint() {
    nodes.forEach((a, i) => {
      const on = states[i].id === current;
      a.classList.toggle("is-current", on);
      if (on) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });
  }

  // One clean pulse along an edge, via WAAPI transforms (no per-frame DOM writes).
  function runPulse(path, reverse, strength = 1) {
    if (!path || reducedMotion()) return;
    const len = path.getTotalLength();
    const frames = [];
    for (let k = 0; k <= 12; k++) {
      const t = reverse ? 1 - k / 12 : k / 12;
      const pt = path.getPointAtLength(t * len);
      frames.push({
        transform: `translate(${pt.x}px, ${pt.y}px)`,
        opacity: (k === 0 || k === 12 ? 0 : 0.95) * strength,
      });
    }
    pulse.animate(frames, { duration: DUR.reveal, easing: "cubic-bezier(0.2, 0, 0, 1)" });
  }

  function set(id) {
    if (id === current) return;
    const from = states.findIndex((s) => s.id === current);
    const to = states.findIndex((s) => s.id === id);
    current = id;
    paint();
    if (Math.abs(to - from) === 1) runPulse(edges[Math.min(from, to)], to < from);
    scheduleAmbient();
  }

  function scheduleAmbient() {
    clearTimeout(ambientTimer);
    if (!o.ambient || reducedMotion()) return;
    ambientTimer = setTimeout(() => {
      if (document.visibilityState === "visible") {
        const i = states.findIndex((s) => s.id === current);
        runPulse(edges[i] || loopEdge, false, 0.45);
      }
      scheduleAmbient();
    }, 4000 + Math.random() * 2000);
  }

  build();
  // Start ambient pulses only after the launch choreography has settled.
  setTimeout(scheduleAmbient, 1800);
  let lastMobile = mobile, lastW = window.innerWidth;
  window.addEventListener("resize", () => {
    const m = isMobile();
    const crossed = (lastW < 1560) !== (window.innerWidth < 1560);
    if (m !== lastMobile || crossed || m) build();
    lastMobile = m;
    lastW = window.innerWidth;
  });

  return { set, get current() { return current; } };
}

// Site-level graph for pages other than home: each page is a state.
export function pageStates(prefix = "") {
  return [
    { id: "home", label: "~/", sub: "home", href: prefix + "index.html" },
    { id: "work", label: "work", sub: "so far", href: prefix + "about.html" },
    { id: "blog", label: "writing", href: prefix + "blog.html" },
    { id: "play", label: "i'm", sub: "bored", href: prefix + "play/" },
    { id: "about", label: "about", sub: "me", href: prefix + "about-more.html" },
  ];
}
