// s₂ — edge. Three beats on the same particles:
//   chip   a die with pins and traces; packets of data travel the traces
//   wave   a voice waveform (the sentence arrives as sound)
//   line   ruled lines; a handwritten answer is written, then a tick evaluates it
//
// Desktop: one sticky pin, beats anchored at fractions of the pin's scroll.
// Mobile: three stacked panels, one slot each; inner motion plays once on entry.

import { Slot } from "../field.js";
import { clamp, rng, mint, grey, easeInOut, smooth } from "../tokens.js";

// Unit-space arrangement helpers. Each returns exactly N [x, y, a, s] rows,
// sorted by x so rank matching keeps morph paths short.
function finish(rows, N) {
  while (rows.length < N) rows.push(rows[rows.length % Math.max(1, rows.length)].slice());
  rows.length = N;
  rows.sort((p, q) => p[0] - q[0]);
  const U = new Float32Array(N * 4);
  rows.forEach((r, i) => U.set(r, i * 4));
  return U;
}

function polyLen(pl) {
  let L = 0;
  for (let i = 1; i < pl.length; i++) L += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
  return L;
}
function polyAt(pl, t) {
  const L = polyLen(pl) * clamp(t);
  let acc = 0;
  for (let i = 1; i < pl.length; i++) {
    const d = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
    if (acc + d >= L) {
      const u = d ? (L - acc) / d : 0;
      return [pl[i - 1][0] + (pl[i][0] - pl[i - 1][0]) * u, pl[i - 1][1] + (pl[i][1] - pl[i - 1][1]) * u];
    }
    acc += d;
  }
  return pl[pl.length - 1].slice();
}

// ------------------------------------------------------------------- chip
function chipGeometry(N) {
  const big = N > 1500;
  const rows = [];
  const D = 0.38;
  const g = big ? 22 : 13;
  for (let i = 0; i < g; i++)
    for (let j = 0; j < g; j++) {
      const x = -D / 2 + ((i + 0.5) * D) / g, y = -D / 2 + ((j + 0.5) * D) / g;
      const core = Math.abs(x) < D * 0.19 && Math.abs(y) < D * 0.19;
      rows.push([x, y, core ? 0.8 : 0.26, core ? 1.7 : 1.3]);
    }
  const per = big ? 9 : 6;
  const traces = [];
  const r = rng(11);
  for (let side = 0; side < 4; side++) {
    const rot = (x, y) => {
      switch (side) {
        case 0: return [x, y];
        case 1: return [-y, x];
        case 2: return [-x, -y];
        default: return [y, -x];
      }
    };
    for (let k = 0; k < per; k++) {
      const yk = -D / 2 + ((k + 0.5) * D) / per;
      // pin
      for (let q = 0; q < 3; q++) rows.push([...rot(D / 2 + 0.008 + q * 0.012, yk), 0.7, 1.4]);
      // trace: out, bend 45°, fan out to the slot edge
      const x0 = D / 2 + 0.036;
      const l1 = 0.02 + r() * 0.05;
      const fan = yk * (0.9 + r() * 0.5);
      const pl = [[x0, yk], [x0 + l1, yk], [x0 + l1 + Math.abs(fan), yk + fan], [0.5, yk + fan]];
      traces.push(pl.map(([x, y]) => rot(x, y)));
    }
  }
  const rest = N - rows.length;
  const total = traces.reduce((s, t) => s + polyLen(t), 0);
  traces.forEach((t) => {
    const c = Math.round((rest * polyLen(t)) / total);
    for (let i = 0; i < c; i++) {
      const [x, y] = polyAt(t, i / Math.max(1, c - 1));
      rows.push([x, y, 0.34, 1.1]);
    }
  });
  return { U: finish(rows, N), traces, D };
}

// ------------------------------------------------------------------- wave
function waveGeometry(N) {
  const B = N > 1500 ? 76 : 46;
  const r = rng(23);
  // A spoken phrase: a few syllable envelopes.
  const syl = [0.12, 0.27, 0.4, 0.55, 0.7, 0.86].map((c) => ({ c, w: 0.04 + r() * 0.04, h: 0.55 + r() * 0.45 }));
  const H = [];
  for (let i = 0; i < B; i++) {
    const u = i / (B - 1);
    let h = 0.02;
    syl.forEach((s) => (h += s.h * Math.exp(-((u - s.c) ** 2) / (2 * s.w * s.w))));
    H.push(Math.min(0.36, h * (0.18 + r() * 0.16)));
  }
  const per = Math.floor(N / B);
  const rows = [];
  for (let i = 0; i < B; i++) {
    const x = -0.46 + (0.92 * i) / (B - 1);
    for (let j = 0; j < per; j++) {
      const y = -H[i] + (2 * H[i] * j) / Math.max(1, per - 1);
      rows.push([x, y, 0.78, 1.5]);
    }
  }
  return { U: finish(rows, N) };
}

// ------------------------------------------------------------- handwriting
// The answer to "why is the sky blue?": Rayleigh scattering, I ∝ 1/λ⁴.
// Strokes in em units: x right, y down, 0..1 = one line of writing.
const STROKES = [
  [[0.12, 0.06], [0.1, 0.5], [0.09, 0.97]], // I
  [[1.36, 0.42], [1.12, 0.76], [0.9, 0.8], [0.76, 0.66], [0.82, 0.48], [1.02, 0.46], [1.2, 0.62], [1.38, 0.82]], // ∝
  [[2.02, 0.13], [2.11, 0.02], [2.12, 0.42]], // 1
  [[1.74, 0.5], [2.2, 0.49], [2.66, 0.51]], // fraction bar
  [[1.92, 0.6], [2.01, 0.63], [2.12, 0.8], [2.26, 0.99]], // λ, long leg
  [[2.12, 0.79], [2.03, 0.88], [1.94, 0.99]], // λ, short leg
  [[2.48, 0.55], [2.34, 0.74], [2.52, 0.74]], // 4
  [[2.46, 0.6], [2.46, 0.85]],
];
const TICK = [[3.05, 0.6], [3.2, 0.84], [3.56, 0.18]];

function wobble(strokes, seed) {
  const r = rng(seed);
  return strokes.map((s) => s.map(([x, y]) => [x + (r() - 0.5) * 0.03, y + (r() - 0.5) * 0.03]));
}

function lineGeometry(N) {
  const rows = [];
  const lines = [-0.16, 0.06, 0.28];
  const margin = Math.round(N * 0.1);
  for (let i = 0; i < margin; i++) rows.push([-0.38, -0.34 + (0.74 * i) / (margin - 1), 0.22, 1.1]);
  const per = Math.floor((N - margin) / lines.length);
  lines.forEach((y) => {
    for (let i = 0; i < per; i++) rows.push([-0.46 + (0.92 * i) / (per - 1), y, 0.17, 1.1]);
  });
  return { U: finish(rows, N) };
}

// --------------------------------------------------------------- keyframes
// `stacked()` is true when the beats are laid out as separate panels
// (mobile, or reduced motion), false when they share one sticky pin.
export function edgeKeyframes({ slotEls, pin, section, stacked, N }) {
  let mobile = stacked();
  let slots = [];
  const configure = () => {
    mobile = stacked();
    const sticky = mobile ? null : { pin, section };
    slots = (mobile ? slotEls : [slotEls[0], slotEls[0], slotEls[0]]).map((el) => new Slot(el, sticky));
  };
  configure();
  const FR = [0.06, 0.5, 0.94];
  const chip = chipGeometry(N), wave = waveGeometry(N), line = lineGeometry(N);
  const ink = wobble(STROKES, 5);
  const tick = wobble([TICK], 9)[0];
  const inkLen = ink.map(polyLen);
  const inkTotal = inkLen.reduce((a, b) => a + b, 0);
  const pr = rng(31);
  const packets = Array.from({ length: mobile ? 8 : 14 }, () => ({
    t: Math.floor(pr() * chip.traces.length), speed: 0.18 + pr() * 0.22, phase: pr(),
  }));

  const scale = (r) => Math.min(r.w, r.h);
  const fromUnit = (U, i) => (out, env) => {
    const r = slots[i].at(env.y);
    const S = scale(r);
    for (let i = 0; i < env.N; i++) {
      out.x[i] = r.cx + U[i * 4] * S;
      out.y[i] = r.cy + U[i * 4 + 1] * S;
      out.a[i] = U[i * 4 + 2];
      out.s[i] = U[i * 4 + 3];
    }
  };
  const anchorFor = (i) => () => {
    const s = slots[i].measure();
    return mobile ? s.centredAt() : s.secTop + FR[i] * (s.secEnd - s.secTop);
  };

  const seen = [0, 0, 0];
  const onceProgress = (i, env, dur) => {
    if (env.reduce) return 1;
    const r = slots[i].at(env.y);
    if (!seen[i] && r.cy < env.vh * 0.72) seen[i] = env.now;
    return seen[i] ? clamp((env.now - seen[i]) / dur) : 0;
  };

  const kChip = {
    id: "chip", state: "s2", type: "points",
    layout() { configure(); this.anchor = anchorFor(0)(); },
    fill: fromUnit(chip.U, 0),
    animated: () => true,
    overlay(ctx, w, env) {
      const r = slots[0].at(env.y);
      const S = scale(r);
      const D = chip.D * S;
      ctx.lineWidth = 1;
      ctx.strokeStyle = mint(0.5 * w);
      ctx.strokeRect(r.cx - D / 2 - 3.5, r.cy - D / 2 - 3.5, D + 7, D + 7);
      ctx.font = "400 10px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.fillStyle = grey(0.45 * w);
      ctx.fillText("edge-npu", r.cx - D / 2, r.cy + D / 2 + 22);
      if (env.reduce) return;
      // Packets inbound along the traces: data moving to the device.
      const t = (env.now - env.t0) / 1000;
      packets.forEach((p) => {
        const tr = chip.traces[p.t];
        const u = 1 - ((t * p.speed + p.phase) % 1);
        for (let k = 0; k < 4; k++) {
          const [x, y] = polyAt(tr, u + k * 0.025);
          ctx.fillStyle = mint((1 - k / 4) * 0.95 * w);
          ctx.fillRect(r.cx + x * S - 1.5, r.cy + y * S - 1.5, 3, 3);
        }
      });
    },
  };

  const kWave = {
    id: "wave", state: "s2", type: "points",
    layout() { this.anchor = anchorFor(1)(); },
    fill: fromUnit(wave.U, 1),
    overlay(ctx, w, env) {
      const r = slots[1].at(env.y);
      const S = scale(r);
      ctx.fillStyle = grey(0.08 * w);
      ctx.fillRect(r.cx - 0.48 * S, r.cy, 0.96 * S, 1);
    },
  };

  const kLine = {
    id: "line", state: "s2", type: "points",
    layout() { this.anchor = anchorFor(2)(); },
    fill: fromUnit(line.U, 2),
    progress(env) {
      if (env.reduce) return 1;
      if (mobile) return onceProgress(2, env, 1900);
      const a0 = this.prevAnchor ?? this.anchor - env.vh;
      return clamp((env.y - (this.anchor - (this.anchor - a0) * 0.5)) / ((this.anchor - a0) * 0.45));
    },
    animated(env) { return mobile && this.progress(env) < 1; },
    overlay(ctx, w, env) {
      const r = slots[2].at(env.y);
      const S = scale(r);
      const em = 0.2 * S; // one line of writing
      const ox = r.cx - 0.3 * S, oy = r.cy + 0.06 * S - em; // sits on the middle rule
      const p = this.progress(env);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1.6, S * 0.006);
      ctx.strokeStyle = grey(0.92 * w);
      let left = clamp(p / 0.82) * inkTotal; // first 82%: the answer; then the tick
      for (let s = 0; s < ink.length && left > 0; s++) {
        const pl = ink[s];
        const f = Math.min(1, left / inkLen[s]);
        left -= inkLen[s];
        ctx.beginPath();
        ctx.moveTo(ox + pl[0][0] * em, oy + pl[0][1] * em);
        const steps = 18;
        for (let k = 1; k <= steps * f; k++) {
          const [x, y] = polyAt(pl, k / steps);
          ctx.lineTo(ox + x * em, oy + y * em);
        }
        if (f < 1) {
          const [x, y] = polyAt(pl, f);
          ctx.lineTo(ox + x * em, oy + y * em);
        }
        ctx.stroke();
      }
      const tp = smooth(0.86, 1, p);
      if (tp > 0) {
        ctx.strokeStyle = mint(w);
        ctx.lineWidth = Math.max(2, S * 0.008);
        ctx.beginPath();
        ctx.moveTo(ox + tick[0][0] * em, oy + tick[0][1] * em);
        for (let k = 1; k <= 20 * tp; k++) {
          const [x, y] = polyAt(tick, k / 20);
          ctx.lineTo(ox + x * em, oy + y * em);
        }
        ctx.stroke();
      }
      ctx.lineCap = "butt";
    },
  };

  // Which beat's caption is showing (desktop pin only).
  const activeBeat = (env) => {
    const a = [kChip.anchor, kWave.anchor, kLine.anchor];
    let best = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(env.y - a[i]) < Math.abs(env.y - a[best])) best = i;
    return best;
  };
  return { keyframes: [kChip, kWave, kLine], activeBeat, isStacked: () => mobile };
}
