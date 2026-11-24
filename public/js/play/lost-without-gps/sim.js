// lost-without-gps: pure game logic, no DOM (spec §7.2, CONCEPT §3.2).
// Uses only + − × ÷ and Math.sqrt, with direction and rotation tables as
// literals, so every browser builds the identical puzzle and filter run.

import { rng } from "../../motion/tokens.js";
import { dailySeed } from "../daily.js";

export const SLUG = "lost-without-gps";
export const W = 60; // metres
export const H = 40;
export const TURNS = 8;
export const MARGIN = 4;
export const RANGE_SIGMA = 0.5;
export const NLOS_P = 0.15;
export const PARTICLES = 500;

// 16 compass directions, k × 22.5°, as literal unit vectors (x east, y south).
const DIRS = [
  [1, 0], [0.9238795325, 0.3826834324], [0.7071067812, 0.7071067812], [0.3826834324, 0.9238795325],
  [0, 1], [-0.3826834324, 0.9238795325], [-0.7071067812, 0.7071067812], [-0.9238795325, 0.3826834324],
  [-1, 0], [-0.9238795325, -0.3826834324], [-0.7071067812, -0.7071067812], [-0.3826834324, -0.9238795325],
  [0, -1], [0.3826834324, -0.9238795325], [0.7071067812, -0.7071067812], [0.9238795325, -0.3826834324],
];
// cos/sin of k × 3°, k = 0..8: the IMU's accumulated heading bias.
const ROT = [
  [1, 0], [0.9986295348, 0.0523359562], [0.9945218954, 0.1045284633], [0.9876883406, 0.1564344650],
  [0.9781476007, 0.2079116908], [0.9659258263, 0.2588190451], [0.9510565163, 0.3090169944],
  [0.9335804265, 0.3583679495], [0.9135454576, 0.4067366431],
];
const COS25 = 0.906307787;

const between = (r, a, b) => a + (b - a) * r();
// Approximately standard normal: sum of 12 uniforms minus 6.
function gauss(r) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += r();
  return s - 6;
}
const dist = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
};

// Anchors: a fat triangle (area ≥ 300 m², every angle ≥ 25°) inside the map.
function anchors(r) {
  for (;;) {
    const A = [0, 1, 2].map(() => [between(r, 3, W - 3), between(r, 3, H - 3)]);
    const area = Math.abs((A[1][0] - A[0][0]) * (A[2][1] - A[0][1]) - (A[2][0] - A[0][0]) * (A[1][1] - A[0][1])) / 2;
    if (area < 300) continue;
    let ok = true;
    for (let i = 0; i < 3 && ok; i++) {
      const p = A[i], q = A[(i + 1) % 3], s = A[(i + 2) % 3];
      const ux = q[0] - p[0], uy = q[1] - p[1], vx = s[0] - p[0], vy = s[1] - p[1];
      const cos = (ux * vx + uy * vy) / Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
      if (cos > COS25) ok = false;
    }
    if (ok) return A;
  }
}

const inside = (x, y) => x >= MARGIN && x <= W - MARGIN && y >= MARGIN && y <= H - MARGIN;

// True path: start plus TURNS positions.
function path(r) {
  const P = [[between(r, 12, W - 12), between(r, 10, H - 10)]];
  let hd = Math.floor(r() * 16);
  for (let t = 0; t < TURNS; t++) {
    const len = between(r, 3.5, 6.5);
    const [x, y] = P[t];
    let turn = Math.floor(r() * 5) - 2;
    // Try the drawn turn first, then progressively wider ones until inside.
    for (let k = 0; k < 16; k++) {
      const h2 = (hd + turn + (k % 2 ? k : -k) * 1 + 64) % 16;
      const nx = x + DIRS[h2][0] * len, ny = y + DIRS[h2][1] * len;
      if (inside(nx, ny)) {
        hd = h2;
        P.push([nx, ny]);
        break;
      }
      if (k === 15) {
        // Unreachable in practice; stay put rather than leave the map.
        P.push([x, y]);
      }
    }
    turn = 0;
  }
  return P;
}

export function create(puzzle) {
  const r = rng(dailySeed(SLUG, puzzle));
  const A = anchors(r);
  const truth = path(r);
  const scale = (r() < 0.5 ? -1 : 1) * between(r, 0.04, 0.08);
  const sign = r() < 0.5 ? -1 : 1;
  // Two turns (never the first) lose one anchor.
  const occluded = new Array(TURNS).fill(-1);
  const t1 = 1 + Math.floor(r() * (TURNS - 1));
  let t2 = 1 + Math.floor(r() * (TURNS - 2));
  if (t2 >= t1) t2++;
  occluded[t1] = Math.floor(r() * 3);
  occluded[t2] = Math.floor(r() * 3);

  const turns = [];
  for (let t = 0; t < TURNS; t++) {
    const [x0, y0] = truth[t], [x1, y1] = truth[t + 1];
    // IMU: true step, scaled and rotated by a bias that grows each turn.
    const dx = (x1 - x0) * (1 + scale), dy = (y1 - y0) * (1 + scale);
    const [c, s0] = ROT[t + 1];
    const s = s0 * sign;
    const imu = [dx * c - dy * s, dx * s + dy * c];
    const ranges = A.map(([ax, ay], i) => {
      if (occluded[t] === i) return null;
      const nlos = r() < NLOS_P;
      const d = dist(x1, y1, ax, ay) + gauss(r) * RANGE_SIGMA + (nlos ? between(r, 1.5, 5) : 0);
      return { d: d < 0.2 ? 0.2 : d, nlos };
    });
    turns.push({ imu, ranges });
  }
  const filter = runFilter(r, truth[0], A, turns);
  return { puzzle, anchors: A, truth, turns, filter, guesses: [] };
}

// Heavy-tailed rational kernel in place of a Gaussian: robust to NLOS.
const kernel = (e, sg) => {
  const u = (e / sg) * (e / sg);
  return 1 / ((1 + u) * (1 + u));
};

/**
 * Bootstrap particle filter: predict with the IMU step plus noise, weight by
 * the ranges, estimate the weighted mean, resample systematically.
 * Returns per-turn estimates and particle snapshots (after weighting, before
 * resampling) for the reveal.
 */
export function runFilter(r, start, A, turns) {
  const N = PARTICLES;
  let px = new Float64Array(N), py = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    px[i] = start[0] + gauss(r) * 0.3;
    py[i] = start[1] + gauss(r) * 0.3;
  }
  const est = [], clouds = [];
  const w = new Float64Array(N);
  for (const { imu, ranges } of turns) {
    const step = Math.sqrt(imu[0] * imu[0] + imu[1] * imu[1]);
    const sg = 0.25 + 0.22 * step;
    for (let i = 0; i < N; i++) {
      px[i] += imu[0] + gauss(r) * sg;
      py[i] += imu[1] + gauss(r) * sg;
    }
    let total = 0;
    for (let i = 0; i < N; i++) {
      let wi = 1;
      for (let a = 0; a < 3; a++) {
        const m = ranges[a];
        if (!m) continue;
        // NLOS only ever lengthens a range, so a measured range longer than
        // predicted is judged more leniently than a shorter one.
        const e = m.d - dist(px[i], py[i], A[a][0], A[a][1]);
        wi *= kernel(e, e > 0 ? 1.5 : 0.6);
      }
      w[i] = wi;
      total += wi;
    }
    let ex = 0, ey = 0;
    for (let i = 0; i < N; i++) {
      w[i] = total > 0 ? w[i] / total : 1 / N;
      ex += w[i] * px[i];
      ey += w[i] * py[i];
    }
    est.push([ex, ey]);
    clouds.push({ x: px.slice(), y: py.slice(), w: w.slice() });
    // Systematic resampling.
    const nx = new Float64Array(N), ny = new Float64Array(N);
    let u = r() / N, c = w[0], j = 0;
    for (let i = 0; i < N; i++) {
      while (u > c && j < N - 1) c += w[++j];
      nx[i] = px[j];
      ny[i] = py[j];
      u += 1 / N;
    }
    px = nx;
    py = ny;
  }
  return { est, clouds };
}

// action: { x, y } in metres
export function step(state, action) {
  if (isOver(state)) return state;
  const x = Math.min(W, Math.max(0, action.x)), y = Math.min(H, Math.max(0, action.y));
  return { ...state, guesses: [...state.guesses, [x, y]] };
}

export const isOver = (state) => state.guesses.length >= TURNS;
export const turn = (state) => state.guesses.length; // 0-based index of the turn being guessed

export function errors(state) {
  return state.guesses.map(([x, y], t) => dist(x, y, state.truth[t + 1][0], state.truth[t + 1][1]));
}
export function filterErrors(state) {
  return state.filter.est.map(([x, y], t) => dist(x, y, state.truth[t + 1][0], state.truth[t + 1][1]));
}
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
// Mean error in metres, to 0.1 m (lower is better).
export const score = (state) => Math.round(mean(errors(state)) * 10) / 10;
export const filterScore = (state) => Math.round(mean(filterErrors(state)) * 10) / 10;
export function beats(state) {
  const f = filterErrors(state);
  return errors(state).filter((e, t) => e < f[t]).length;
}

export function shareText(puzzle, err, beat) {
  return `lost-without-gps #${puzzle} · ${err.toFixed(1)} m · beat the filter ${beat}/${TURNS} · markovstate.sh/play/lost-without-gps`;
}

export const EXPLAINER = [
  "The filter tracked 500 guesses at once, each one a possible position for the vehicle.",
  "Every turn it moved them all by the IMU's step, with some spread added because the IMU drifts.",
  "Then it scored each guess by how well it matched the ranges. A signal that bounces off a wall (NLOS) only ever reads too long, so too-long ranges were trusted less than too-short ones, and no single bad range could drag it off.",
  "It kept the high scorers, dropped the rest and reported their average: that collapsing cloud is the estimate.",
];
