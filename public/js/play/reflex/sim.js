// reflex: rules. No DOM, so it runs under Node (spec §6 rule 3).
// 5 rounds: wait for green, tap. Tapping early (or impossibly fast) is a
// false start and the round is replayed with a new wait. Score = mean ms.

import { rng } from "../../motion/tokens.js";

export const SLUG = "reflex";
export const ROUNDS = 5;
// Faster than this is anticipation, not reaction.
export const MIN_MS = 90;
// Slower than this counts as "missed": the round is replayed.
export const MAX_MS = 2000;

export function create(seed) {
  const u = rng(seed);
  const waits = [];
  // Enough waits for every round plus plenty of false starts.
  for (let i = 0; i < 40; i++) waits.push(1100 + Math.floor(u() * 2900));
  return { seed: seed >>> 0, waits, times: [], falseStarts: 0 };
}

// Wait before the next green, in ms.
export const nextWait = (state) => state.waits[(state.times.length + state.falseStarts) % state.waits.length];

// action: { ms } for a tap after green (ms since green), { early: true } for a tap before.
export function step(state, action) {
  if (isOver(state)) return { ...state, result: "ignored" };
  if (action.early || action.ms < MIN_MS) return { ...state, falseStarts: state.falseStarts + 1, result: "early" };
  if (action.ms > MAX_MS) return { ...state, falseStarts: state.falseStarts + 1, result: "slow" };
  return { ...state, times: [...state.times, Math.round(action.ms)], result: "ok" };
}

export const isOver = (state) => state.times.length >= ROUNDS;

export function score(state) {
  const t = state.times;
  if (!t.length) return 0;
  return Math.round(t.reduce((a, b) => a + b, 0) / t.length);
}

export const best = (state) => (state.times.length ? Math.min(...state.times) : 0);

export function tier(ms) {
  if (ms < 200) return "lightning";
  if (ms < 240) return "cat-like";
  if (ms < 280) return "quick";
  if (ms < 330) return "solid";
  if (ms < 400) return "steady";
  return "taking it easy";
}

export function shareText(ms, link) {
  return `my reaction time: ${ms} ms (avg of ${ROUNDS}). beat it: ${link}`;
}
