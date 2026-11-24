// how many?: rules. No DOM, so it runs under Node (spec §6 rule 3).
// Each day: 5 clouds of dots, bigger every round. Each one flashes briefly;
// the player guesses the count. Score = mean percentage off, lower is better.
// Bit-exact across engines: only + − × ÷, floor and seeded rng (rule 4).

import { rng } from "../../motion/tokens.js";
import { dailySeed } from "../daily.js";

export const SLUG = "how-many";
export const ROUNDS = 5;
export const W = 1500; // field units; the view letterboxes this 3:2 box
export const H = 1000;
export const MAX_GUESS = 9999;

// Count range per round: each cloud is bigger than the last.
const RANGES = [[12, 25], [30, 55], [60, 105], [115, 185], [195, 320]];
export const LAYOUTS = ["scatter", "clumps", "sizes"];
// How long each cloud is on screen, in ms. Long enough to take in, too short to count.
export const SHOW_MS = [2000, 1800, 1700, 1600, 1600];

// Gaussian-ish noise in about [-1, 1]: a sum of uniforms (no Math.log/cos).
const gauss = (u) => (u() + u() + u() + u() - 2) / 2;

function place(u, n, layout) {
  const base = n < 40 ? 20 : n < 90 ? 16 : n < 170 ? 13 : 11;
  const dots = [];
  let centres = null;
  if (layout === "clumps") {
    const k = 2 + Math.floor(u() * 3);
    centres = [];
    for (let i = 0; i < k; i++) centres.push([200 + Math.floor(u() * (W - 400)), 180 + Math.floor(u() * (H - 360)), 160 + Math.floor(u() * 160)]);
  }
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 80; tries++) {
      const r = layout === "sizes" ? 7 + Math.floor(u() * 20) : base;
      const m = r + 14;
      let x, y;
      if (centres) {
        const c = centres[Math.floor(u() * centres.length)];
        x = Math.floor(c[0] + gauss(u) * c[2] * 1.6);
        y = Math.floor(c[1] + gauss(u) * c[2] * 1.2);
      } else {
        x = Math.floor(m + u() * (W - 2 * m));
        y = Math.floor(m + u() * (H - 2 * m));
      }
      if (x < m || x > W - m || y < m || y > H - m) continue;
      let ok = true;
      for (const d of dots) {
        const gap = d.r + r + 5;
        const dx = d.x - x, dy = d.y - y;
        if (dx * dx + dy * dy < gap * gap) {
          ok = false;
          break;
        }
      }
      if (ok) {
        dots.push({ x, y, r });
        break;
      }
    }
  }
  return dots;
}

export function create(puzzle) {
  const u = rng(dailySeed(SLUG, puzzle));
  // Layout order: a shuffle of the three, then two more picks, so every day
  // has each kind at least once.
  const order = LAYOUTS.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(u() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.push(LAYOUTS[Math.floor(u() * 3)], LAYOUTS[Math.floor(u() * 3)]);
  const rounds = RANGES.map(([lo, hi], i) => {
    const want = lo + Math.floor(u() * (hi - lo + 1));
    const dots = place(u, want, order[i]);
    return { layout: order[i], dots, n: dots.length, ms: SHOW_MS[i] };
  });
  return { puzzle, rounds, guesses: [] };
}

export const parseGuess = (s) => {
  const t = String(s).trim().replace(/[,\s]/g, "");
  if (!/^\d{1,4}$/.test(t)) return null;
  const g = parseInt(t, 10);
  return g >= 1 && g <= MAX_GUESS ? g : null;
};

export function step(state, { guess }) {
  if (isOver(state) || !(guess >= 1)) return state;
  return { ...state, guesses: [...state.guesses, guess] };
}

export const isOver = (state) => state.guesses.length >= ROUNDS;

// Fraction off for one round: |guess − truth| / truth.
export const off = (g, n) => Math.abs(g - n) / n;

// Mean percentage off, to one decimal (12.3 means 12.3 %).
export function score(state) {
  const g = state.guesses;
  if (!g.length) return 0;
  let s = 0;
  g.forEach((v, i) => (s += off(v, state.rounds[i].n)));
  return Math.round((s / g.length) * 1000) / 10;
}

// 2 = within 10 %, 1 = within 25 %, 0 = further.
export const grade = (g, n) => (off(g, n) <= 0.1 ? 2 : off(g, n) <= 0.25 ? 1 : 0);
export const SQUARE = ["🟥", "🟨", "🟩"];

export function tier(pct) {
  if (pct <= 5) return "human abacus";
  if (pct <= 12) return "sharp eye";
  if (pct <= 22) return "good guesser";
  if (pct <= 40) return "ballpark";
  return "optimist";
}

export function roundLine(g, n) {
  const p = Math.round(off(g, n) * 100);
  if (g === n) return `exactly ${n}. bullseye.`;
  return `you said ${g} · there were ${n} · ${p}% ${g > n ? "over" : "under"}`;
}

export function shareText(puzzle, pct, grades) {
  return `how many? #${puzzle} · ${pct}% off · ${grades.map((g) => SQUARE[g]).join("")}\nmarkovstate.sh/play/how-many.html`;
}
