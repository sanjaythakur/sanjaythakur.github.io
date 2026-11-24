// Daily puzzles (spec §12). One puzzle for everyone, resetting at 00:00 UTC.
// Puzzle #1 is LAUNCH_UTC. Set it to the launch date before going live.
// Pure: safe to import in Node for tests.

import { hash } from "../motion/tokens.js";

export const LAUNCH_UTC = Date.UTC(2026, 10, 24); // 2026-11-24 (month is 0-based)
const DAY = 86400000;

export function puzzleNumber(now = Date.now()) {
  return Math.max(1, Math.floor((now - LAUNCH_UTC) / DAY) + 1);
}

export function msUntilNext(now = Date.now()) {
  return DAY - (((now - LAUNCH_UTC) % DAY) + DAY) % DAY;
}

// "07:12:09": the countdown to the next puzzle. It is a duration, so it reads
// the same in every time zone; the reset itself is 00:00 UTC.
export function countdown(now = Date.now()) {
  const s = Math.ceil(msUntilNext(now) / 1000);
  const p = (v) => String(v).padStart(2, "0");
  return `${p(Math.floor(s / 3600) % 24)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}

export const dailySeed = (slug, n) => hash(`markovstate:${slug}:${n}`);

// Current streak from a {puzzleNumber: result} map: consecutive puzzles played,
// ending today, or yesterday if today is not played yet.
export function streak(results, today = puzzleNumber()) {
  let n = results[today] ? today : today - 1;
  let s = 0;
  while (n >= 1 && results[n]) {
    s++;
    n--;
  }
  return s;
}
