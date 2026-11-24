// Autopilots for tuning and testing drift. Not a test file: imported by
// drift.test.mjs and runnable directly: node tools/play/drift-bots.mjs
import * as D from "../../public/js/play/drift/sim.js";

// Steer `estimate` towards a target height with a little look-ahead.
function steer(s, estimate, lookM = 6) {
  const ahead = D.corridorAt(s, s.x + lookM * D.UNITS_PER_M);
  let target = ahead.centre;
  const b = s.beacons[s.nextBeacon];
  if (b && b.x - s.x < 8 * D.UNITS_PER_M) target = b.y; // line up with the gate late
  return estimate > target - s.vy * 0.18;
}

// Knows the truth. A strong pilot, not a proof: see reachable() for that.
export const oracle = (s) => steer(s, s.y);
// Flies the estimate only, like a player who ignores the ghost.
export const naive = (s) => steer(s, D.shown(s));
// Uses the ghost while it is visible, the estimate otherwise.
export const attentive = (s) => steer(s, D.ghostAlpha(s) > 0.15 ? s.y : D.shown(s));

// Learns the drift rate while the ghost is visible, then extrapolates the
// truth once it fades: roughly what a good human player does.
export function skilled() {
  let last = 0, rate = 0, seenAt = 0;
  return (s) => {
    let est;
    if (D.ghostAlpha(s) > 0.15) {
      if (s.tick - seenAt === 1) rate = rate * 0.97 + (s.bias - last) * 0.03;
      else rate = 0;
      last = s.bias;
      seenAt = s.tick;
      est = s.y;
    } else {
      est = D.shown(s) - (last + rate * (s.tick - seenAt));
    }
    return steer(s, est);
  };
}

// Geometric passability: the band of heights reachable tick by tick at 85%
// of the climb rate (margin for inertia), clipped to the corridor. Returns
// the distance in metres at which the band first empties, or Infinity.
export function reachable(seed, toM) {
  const s = D.create(seed);
  let lo = 50, hi = 50, x = 0;
  const v = (0.85 * D.CLIMB) / D.HZ;
  while (x < toM * D.UNITS_PER_M) {
    x += (D.speedAt(x / D.UNITS_PER_M) * D.UNITS_PER_M) / D.HZ;
    const c = D.corridorAt(s, x);
    lo = Math.max(lo - v, c.top + D.RADIUS + 0.01);
    hi = Math.min(hi + v, c.bottom - D.RADIUS - 0.01);
    if (lo > hi) return x / D.UNITS_PER_M;
  }
  return Infinity;
}

export function run(seed, bot, maxTicks = D.HZ * 400) {
  const s = D.create(seed);
  const toggles = [];
  let climb = false;
  while (!s.over && s.tick < maxTicks) {
    const want = bot(s);
    if (want !== climb) {
      toggles.push(s.tick);
      climb = want;
    }
    D.step(s, climb);
  }
  return { s, toggles, m: D.score(s) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const N = 200;
  for (const [name, make] of Object.entries({ oracle: () => oracle, naive: () => naive, attentive: () => attentive, skilled })) {
    const ms = [];
    for (let i = 1; i <= N; i++) ms.push(run(i * 2654435761, make()).m);
    ms.sort((a, b) => a - b);
    const q = (p) => ms[Math.floor(p * (N - 1))];
    console.log(name.padEnd(10), "p10", q(0.1), "median", q(0.5), "p90", q(0.9), "max", ms[N - 1]);
  }
}
