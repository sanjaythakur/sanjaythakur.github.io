// echo: rules. No DOM, so it runs under Node (spec §6 rule 3).
// A dot hops between 4 shapes; the player taps the same path back. Each level
// adds one hop. One wrong tap ends the run. Score = longest path repeated.
// The whole path comes from the seed, so a challenge link replays it exactly.

import { rng } from "../../motion/tokens.js";

export const SLUG = "echo";
export const N = 4;
export const MAX = 99;

export function create(seed) {
  const u = rng(seed);
  // A hop always moves: the next node is one of the other three.
  const path = [Math.floor(u() * N)];
  while (path.length < MAX) path.push((path[path.length - 1] + 1 + Math.floor(u() * (N - 1))) % N);
  return { seed: seed >>> 0, path, level: 1, pos: 0, over: false, wrong: -1 };
}

// The path to show and repeat at this level: level + 1 nodes (level hops).
export const shown = (state) => state.path.slice(0, state.level + 1);

// Playback speed: a little faster each level, never frantic.
export const hopMs = (level) => Math.max(300, 640 - 24 * (level - 1));

// One tap. Returns the new state; `result` is "ok", "level" (path finished)
// or "wrong".
export function step(state, { tap }) {
  if (state.over) return { ...state, result: "ignored" };
  const want = state.path[state.pos];
  if (tap !== want) return { ...state, over: true, wrong: tap, result: "wrong" };
  const pos = state.pos + 1;
  if (pos === state.level + 1) {
    if (state.level + 1 >= MAX) return { ...state, level: state.level + 1, pos: 0, over: true, result: "level" };
    return { ...state, level: state.level + 1, pos: 0, result: "level" };
  }
  return { ...state, pos, result: "ok" };
}

export const isOver = (state) => state.over;
// Hops repeated correctly in the longest finished path.
export const score = (state) => state.level - 1;

export function tier(s) {
  if (s >= 14) return "photographic";
  if (s >= 10) return "elephant";
  if (s >= 7) return "sharp";
  if (s >= 4) return "warming up";
  return "goldfish mode";
}

export const fmt = (s) => `${s} hop${s === 1 ? "" : "s"}`;

export function shareText(s, link) {
  return `I echoed a ${fmt(s)} path from memory. beat it: ${link}`;
}
