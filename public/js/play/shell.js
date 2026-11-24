// Shared chrome for /play/ pages (spec §11): HUD, sound toggle, live region,
// end screen with one primary CTA and a quiet secondary row, "play another".
// Importing site.js gives the page the same reveal, crosshair and js-class
// behaviour as the rest of the site. The page's HUD host is #playHud, not
// #hud, so site.js does not mount its own (root-relative) HUD over it.

import "../motion/site.js";
import { mountHud } from "../motion/hud.js";
import { bindToggle } from "./audio.js";
import { GAMES, bySlug, X_URL } from "./games.js";
import { share, shareLabel } from "./share.js";
import { puzzleNumber, countdown } from "./daily.js";

// Tiny DOM builder: h("a", {href, class}, "text", child, ...)
export function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c);
  return n;
}

const HOME = { id: "home", label: "~/", sub: "home", href: "../index.html" };
const HUB = { id: "play", label: "i'm", sub: "bored", href: "./" };

export function mountPlayHud(current) {
  const host = document.getElementById("playHud");
  if (!host) return null;
  const states =
    current === "play"
      ? [HOME, HUB, ...GAMES.map((g) => ({ id: g.slug, label: g.hud, href: g.status === "live" ? g.slug + ".html" : "#" + g.slug }))]
      : [HOME, HUB, { id: current, label: bySlug(current).hud, href: current + ".html" }];
  return mountHud(host, { states, current, ambient: true, title: "~/play", absorbing: current !== "play" });
}

let live;
export function announce(text) {
  live = live || document.getElementById("liveRegion");
  if (!live) return;
  live.textContent = "";
  // A fresh text node on the next frame makes screen readers re-announce.
  requestAnimationFrame(() => (live.textContent = text));
}

export function mountGamePage(slug) {
  mountPlayHud(slug);
  const t = document.getElementById("soundToggle");
  if (t) bindToggle(t);
  const other = document.getElementById("playAnother");
  if (other) renderPlayAnother(other, slug);
}

export function renderPlayAnother(el, slug) {
  const others = GAMES.filter((g) => g.slug !== slug);
  const kids = [
    h("span", { class: "muted" }, "play another: "),
    ...others.flatMap((g) => [
      g.status === "live" ? h("a", { href: g.slug + ".html" }, g.title) : h("span", { class: "muted" }, g.title + " (soon)"),
      h("span", { class: "sep", "aria-hidden": "true" }, " · "),
    ]),
    h("a", { href: "./" }, "all games"),
  ];
  el.replaceChildren(...kids);
}

/**
 * Render an end screen into `el`.
 * @param {object} o
 * @param {string} o.title       e.g. "markovle #42"
 * @param {(string|Node)[]} o.lines  result lines under the title
 * @param {{copy:string, href?:string, onClick?:()=>void}} o.primary
 * @param {(()=>void)|null} [o.again]  "play again" handler (Enter / Space / R)
 * @param {{label:string, href?:string, onClick?:(e:Event)=>void}[]} o.secondary
 * @param {Node[]} [o.extra]     appended below (history, top runs, explainer)
 */
export function renderEnd(el, o) {
  const note = h("p", { class: "end__note", role: "status" });
  const say = (s) => (note.textContent = s);
  const arrow = h("span", { class: "arrow", "aria-hidden": "true" }, "→");
  const primary = o.primary.href
    ? h("a", { class: "end__cta", href: o.primary.href }, o.primary.copy + " ", arrow)
    : h("button", { class: "end__cta", type: "button", onclick: () => o.primary.onClick(say) }, o.primary.copy + " ", arrow);
  const row = o.secondary.flatMap((s, i) => [
    i ? h("span", { class: "sep", "aria-hidden": "true" }, " · ") : null,
    s.href
      ? h("a", { href: s.href, target: s.href.startsWith("http") ? "_blank" : null, rel: s.href.startsWith("http") ? "noopener" : null }, s.label)
      : h("button", { type: "button", class: "linklike", onclick: () => s.onClick(say) }, s.label),
  ]);
  const kids = [
    h("p", { class: "end__title" }, o.title),
    ...o.lines.map((l) => h("p", { class: "end__line" }, l)),
    primary,
    o.again && h("button", { class: "btn end__again", type: "button", onclick: o.again }, "play again ", h("kbd", {}, "⏎")),
    h("p", { class: "end__row" }, row),
    note,
    ...(o.extra || []),
  ];
  el.replaceChildren(...kids.filter(Boolean));
  el.hidden = false;
  return { primary, say };
}

// When a round starts, make sure the whole play area is on screen (short
// landscape phones put it below the fold). No-op when it already fits.
export function bringIntoView(el) {
  const r = el.getBoundingClientRect();
  const navH = 64;
  if (r.top >= navH && r.bottom <= innerHeight) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollBy({ top: r.top - navH - Math.max(0, (innerHeight - navH - r.height) / 2), behavior: reduce ? "auto" : "smooth" });
}

// Daily games: "next puzzle in 07:12:09", switching to a link once it is out.
let clockTimer = 0;
export function dailyClock(today, href) {
  const el = h("p", { class: "end__meta" });
  const tick = () => {
    if (puzzleNumber() !== today) {
      el.replaceChildren(h("a", { href }, "a new puzzle is out →"));
      clearInterval(clockTimer);
    } else el.textContent = `next puzzle in ${countdown()} · resets 00:00 UTC`;
  };
  tick();
  clearInterval(clockTimer);
  clockTimer = setInterval(() => document.visibilityState === "visible" && tick(), 1000);
  return el;
}

// Daily games: the last 14 puzzles as squares. grade(result) → 0..2 or -1.
export function dailyHistory(results, today, grade, title) {
  const cells = [];
  for (let n = Math.max(1, today - 13); n <= today; n++) {
    const g = results[n] ? grade(results[n]) : -1;
    cells.push(h("span", { class: "cal__d" + ["", " is-low", " is-ok", " is-good"][g + 1], title: `#${n}: ${results[n] ? title(results[n]) : "not played"}` }));
  }
  return h("div", { class: "cal", "aria-label": "last 14 puzzles" }, cells);
}

// Secondary-row helpers shared by every game.
export const shareItem = (label, text) => ({
  label,
  onClick: async (say) => say(shareLabel[await share(text())] || ""),
});
export const followItem = { label: "follow on x", href: X_URL };
export const anotherItem = { label: "play another", href: "./" };
