// drift: pure game logic, no DOM (spec §7.3, CONCEPT §3.3).
// Fixed 60 Hz tick; the only input is "climbing or not" per tick. Only
// + − × ÷ are used, and three independent seeded streams (corridor, beacons,
// drift) are consumed strictly in order, so a seed always yields the same
// course and the same drift in every browser, whatever the player does.
// For speed, step() mutates the state it is given and returns it.

import { rng } from "../../motion/tokens.js";

export const SLUG = "drift";
export const HZ = 60;
export const WORLD_H = 100; // units; 10 units = 1 m
export const UNITS_PER_M = 10;
export const RADIUS = 2.2; // drone half-height, units
export const CLIMB = 50; // units/s, up or down
export const EASE_IN = 90; // ticks over which vertical speed ramps up at the start
export const BEACON_WINDOW = 9; // half-height of a beacon gate, units
export const DRIFT_PULL = 0.008; // units per tick of steady drift, × (1 + km/0.5)
export const DRIFT_WALK = 0.09; // random-walk step scale, same growth
export const GHOST_FADE = 16; // the true-position ghost is gone at this bias (units)

const m2u = (m) => m * UNITS_PER_M;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => t * t * (3 - 2 * t);

export const speedAt = (xm) => 6 + 8 * clamp(xm / 1200, 0, 1); // m/s
export const widthAt = (xm) => 62 - 36 * clamp(xm / 1500, 0, 1); // units

export function create(seed) {
  seed = seed >>> 0;
  return {
    seed,
    tick: 0,
    x: 0, // units travelled
    y: 50, // true height, units from the top
    vy: 0,
    bias: 0, // shown = y + bias
    driftDir: 1,
    over: false,
    fixes: 0,
    lastFixTick: -999,
    rc: rng(seed ^ 0x2c1b3c6d), // corridor
    rb: rng(seed ^ 0x297a2d39), // beacons
    rd: rng(seed ^ 0x6a09e667), // drift
    seg: [{ x: 0, c: 50 }], // corridor centre control points
    beacons: [], // { x, y, hit }
    nextBeacon: 0, // index of the next beacon ahead
  };
}

// Corridor centre control points, generated in order on demand. Spacing
// shrinks from 40 m to 20 m as the run goes on.
function extendCorridor(s, toX) {
  while (s.seg[s.seg.length - 1].x < toX) {
    const last = s.seg[s.seg.length - 1];
    const xm = last.x / UNITS_PER_M;
    const gap = m2u(40 - 20 * clamp(xm / 1500, 0, 1));
    const half = widthAt(xm + gap / UNITS_PER_M) / 2;
    const lo = 3 + half, hi = WORLD_H - 3 - half;
    const swing = 18 + 22 * clamp(xm / 1000, 0, 1);
    const c = clamp(last.c + (s.rc() * 2 - 1) * swing, lo, hi);
    s.seg.push({ x: last.x + gap, c });
  }
}

export function corridorAt(s, x) {
  extendCorridor(s, x + 1);
  // Binary search for the segment containing x.
  let lo = 0, hi = s.seg.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s.seg[mid].x <= x) lo = mid;
    else hi = mid;
  }
  const a = s.seg[lo], b = s.seg[hi];
  const c = a.c + (b.c - a.c) * smooth((x - a.x) / (b.x - a.x));
  const half = widthAt(x / UNITS_PER_M) / 2;
  return { top: c - half, bottom: c + half, centre: c };
}

// Beacons every 90–160 m, centred in the corridor, generated in order.
export function beaconsUpTo(s, x) {
  let last = s.beacons[s.beacons.length - 1];
  while (!last || last.x <= x) {
    const bx = (last ? last.x : 0) + m2u(90 + 70 * s.rb());
    const jitter = (s.rb() * 2 - 1) * 0.15; // up to 15% of the width off centre
    const k = corridorAt(s, bx);
    last = { x: bx, y: k.centre + jitter * (k.bottom - k.top), hit: false };
    s.beacons.push(last);
  }
  return s.beacons;
}

/**
 * Advance one tick. `climb` is true while the player holds.
 * Returns the (mutated) state.
 */
export function step(s, climb) {
  if (s.over) return s;
  const xm = s.x / UNITS_PER_M;
  const dx = (speedAt(xm) * UNITS_PER_M) / HZ;
  // Gentle start: vertical speed ramps from 35% to full over EASE_IN ticks.
  const ease = s.tick >= EASE_IN ? 1 : 0.35 + (0.65 * s.tick) / EASE_IN;
  const target = (climb ? -CLIMB : CLIMB) * ease;
  s.vy += (target - s.vy) * 0.18;
  s.y += s.vy / HZ;
  s.x += dx;
  s.tick++;

  // Drift: a slow constant pull plus a random walk, both growing with
  // distance. Consumed every tick regardless of input.
  const k = 1 + xm / 500;
  const u = s.rd() + s.rd() + s.rd() - 1.5; // mean 0, sd 0.5
  s.bias += s.driftDir * DRIFT_PULL * k + u * DRIFT_WALK * k;

  // Beacon fix: the true position passes through the gate.
  beaconsUpTo(s, s.x + m2u(200));
  const b = s.beacons[s.nextBeacon];
  if (b && s.x >= b.x) {
    if (s.y > b.y - BEACON_WINDOW && s.y < b.y + BEACON_WINDOW) {
      b.hit = true;
      s.bias = 0;
      s.fixes++;
      s.lastFixTick = s.tick;
    }
    // The pull changes direction at every gate, hit or missed.
    s.driftDir = s.rd() < 0.5 ? -1 : 1;
    s.nextBeacon++;
  }

  const c = corridorAt(s, s.x);
  if (s.y - RADIUS <= c.top || s.y + RADIUS >= c.bottom) s.over = true;
  return s;
}

export const shown = (s) => s.y + s.bias;
export const score = (s) => Math.floor(s.x / UNITS_PER_M); // whole metres
export const isOver = (s) => s.over;
export const ghostAlpha = (s) => Math.max(0, 1 - Math.abs(s.bias) / GHOST_FADE);

/**
 * Replay a run from its seed and input log. inputs: ticks at which the
 * climb state toggles, starting from "not climbing". Used by tests.
 */
export function replay(seed, toggles, maxTicks = HZ * 600) {
  const s = create(seed);
  let climb = false, i = 0;
  while (!s.over && s.tick < maxTicks) {
    while (i < toggles.length && toggles[i] <= s.tick) {
      climb = !climb;
      i++;
    }
    step(s, climb);
  }
  return s;
}

export const fmt = (m) => m.toLocaleString("en-US");

export function shareText(m, link) {
  return `I drifted ${fmt(m)} m before my IMU betrayed me. beat it: ${link}`;
}
