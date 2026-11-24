// markovle: pure game logic, no DOM (spec §7.1, CONCEPT §3.1).
// Chains are n×n integer matrices of tenths; every row sums to 10.
// Only integer maths and + − × ÷ are used, so every browser builds the
// identical puzzle from the same number.

import { rng } from "../../motion/tokens.js";
import { dailySeed } from "../daily.js";

export const SLUG = "markovle";
export const ROUNDS = 5;
export const LENGTHS = [24, 20, 16, 13, 10];
export const LABELS = ["A", "B", "C", "D"];
export const MARGIN = 3; // true chain must be ≥ 3× as likely as every distractor
export const TIERS = [
  [5, "stationary distribution"],
  [4, "well mixed"],
  [3, "burn-in"],
  [0, "random walk"],
];

export const statesFor = (puzzle) => (puzzle % 3 === 0 ? 3 : 4);
export const tier = (correct) => TIERS.find(([min]) => correct >= min)[1];

const pick = (r, n) => Math.floor(r() * n);

// One row: 10 tenths spread over n targets with skewed weights, so rows have
// a clear character (a strong self-loop, a favourite neighbour, a zero).
function randomRow(r, n) {
  const w = [];
  let total = 0;
  for (let j = 0; j < n; j++) {
    const u = r();
    w.push(u * u * u + 0.02);
    total += w[j];
  }
  const row = new Array(n).fill(0);
  for (let k = 0; k < 10; k++) {
    let x = r() * total;
    let j = 0;
    while (j < n - 1 && x >= w[j]) x -= w[j++];
    row[j]++;
  }
  return row;
}

// Every state reachable from every other, and no row that is all self-loop.
function irreducible(P) {
  const n = P.length;
  for (let s = 0; s < n; s++) {
    if (P[s][s] >= 9) return false;
    const seen = new Array(n).fill(false);
    const stack = [s];
    seen[s] = true;
    while (stack.length) {
      const a = stack.pop();
      for (let b = 0; b < n; b++) if (P[a][b] && !seen[b]) (seen[b] = true), stack.push(b);
    }
    if (seen.includes(false)) return false;
  }
  return true;
}

export function randomChain(r, n) {
  for (;;) {
    const P = [];
    for (let i = 0; i < n; i++) P.push(randomRow(r, n));
    if (irreducible(P)) return P;
  }
}

export function sample(r, P, start, len) {
  const t = [start];
  for (let k = 1; k < len; k++) {
    const row = P[t[k - 1]];
    let x = pick(r, 10);
    let j = 0;
    while (x >= row[j]) x -= row[j++];
    t.push(j);
  }
  return t;
}

// Transition counts of a trajectory, n×n.
export function counts(traj, n) {
  const C = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let k = 1; k < traj.length; k++) C[traj[k - 1]][traj[k]]++;
  return C;
}

// Likelihood of the trajectory's transitions under P, as a plain product of
// tenths. At most 23 factors, each ≥ 0.1, so no underflow and no log needed.
export function likelihood(P, traj) {
  let L = 1;
  for (let k = 1; k < traj.length; k++) L *= P[traj[k - 1]][traj[k]] / 10;
  return L;
}

const same = (A, B) => A.every((row, i) => row.every((v, j) => v === B[i][j]));

// Move m tenths between two entries of one or two rows.
function perturb(r, P, m) {
  const n = P.length;
  const D = P.map((row) => row.slice());
  const rows = 1 + pick(r, 2);
  for (let k = 0; k < rows; k++) {
    const i = pick(r, n);
    const from = pick(r, n);
    let to = pick(r, n - 1);
    if (to >= from) to++;
    const amt = Math.min(m, D[i][from]);
    if (!amt) continue;
    D[i][from] -= amt;
    D[i][to] += amt;
  }
  return D;
}

function makeRound(r, n, len) {
  for (let tries = 0; ; tries++) {
    const P = randomChain(r, n);
    const traj = sample(r, P, pick(r, n), len);
    // Long rounds visit every state; short ones may skip one.
    if (new Set(traj).size < (len >= 16 ? n : n - 1)) continue;
    const L = likelihood(P, traj);
    const ds = [];
    for (let a = 0; a < 400 && ds.length < 3; a++) {
      const D = perturb(r, P, 1 + pick(r, 3) + Math.floor(a / 100));
      if (same(D, P) || ds.some((E) => same(D, E))) continue;
      if (!(L >= MARGIN * likelihood(D, traj))) continue;
      // Keep the game honest, not trivial: at most one distractor that the
      // trajectory rules out outright (it uses a transition the graph lacks).
      if (likelihood(D, traj) === 0 && ds.some((E) => likelihood(E, traj) === 0)) continue;
      ds.push(D);
    }
    if (ds.length < 3) continue;
    const candidates = [P, ...ds];
    // Fisher–Yates with the same stream: the answer's slot is seeded too.
    const order = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) {
      const j = pick(r, i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    return {
      chain: P,
      traj,
      candidates: order.map((k) => candidates[k]),
      answer: order.indexOf(0),
    };
  }
}

export function create(puzzle) {
  const r = rng(dailySeed(SLUG, puzzle));
  const n = statesFor(puzzle);
  return {
    puzzle,
    n,
    rounds: LENGTHS.map((len) => makeRound(r, n, len)),
    picks: [],
  };
}

// action: { pick: candidate index }
export function step(state, action) {
  if (isOver(state)) return state;
  return { ...state, picks: [...state.picks, action.pick] };
}

export const isOver = (state) => state.picks.length >= ROUNDS;
export const marks = (state) => state.picks.map((p, i) => p === state.rounds[i].answer);
export const score = (state) => marks(state).filter(Boolean).length;

// One-line intuition after an answer: the transition where the true chain
// and the chosen (or, if right, the most plausible wrong) graph differ most,
// weighted by how often the trajectory used that row.
export function intuition(round, pick) {
  const { chain: P, traj, candidates, answer } = round;
  const n = P.length;
  let other = candidates[pick];
  if (pick === answer) {
    let best = -1;
    candidates.forEach((D, k) => {
      if (k === answer) return;
      const L = likelihood(D, traj);
      if (L > best) (best = L), (other = D);
    });
  }
  const C = counts(traj, n);
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i] += C[i][j];
  let bi = 0, bj = 0, bv = -1;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const v = Math.abs(P[i][j] - other[i][j]) * (1 + C[i][j]) * (out[i] ? 2 : 1);
      if (v > bv) (bv = v), (bi = i), (bj = j);
    }
  const a = LABELS[bi], b = LABELS[bj];
  const t = (P[bi][bj] / 10).toFixed(1), o = (other[bi][bj] / 10).toFixed(1);
  const c = C[bi][bj];
  const seen = c === 0 ? "and it never happened" : c === 1 ? "and it happened once" : `and it happened ${c} times`;
  const lead = pick === answer ? "right." : "not quite.";
  const who = pick === answer ? "the closest decoy said" : "your pick said";
  return `${lead} ${a} → ${b} is really ${t}; ${who} ${o}, ${seen}.`;
}

export function shareText(puzzle, m) {
  const sq = m.map((ok) => (ok ? "🟩" : "🟥")).join("");
  return `markovle #${puzzle} ${m.filter(Boolean).length}/${ROUNDS} ${sq} markovstate.sh/play/markovle`;
}
