// s₀ / s₁ — the point-cloud globe and the journey arcs.
// India-centric. Arcs trace the stops named on the site and converge on Bengaluru.

import { MASK_COLS, MASK_ROWS, MASK_B64 } from "./landmask.js";
import { Slot } from "../field.js";
import { clamp, easeOut, easeInOut, smooth, mint, grey, lerp } from "../tokens.js";

const RAD = Math.PI / 180;

// Journey stops. Places come from the site's own text (about-more.html).
// Order is assumed; confirm with the owner (CONCEPT §8, question 1).
export const STOPS = [
  { name: "jaipur", lat: 26.91, lng: 75.79 },
  { name: "montréal", lat: 45.5, lng: -73.57 },
  { name: "toronto", lat: 43.65, lng: -79.38, left: true },
  { name: "singapore", lat: 1.35, lng: 103.82 },
  { name: "bengaluru", lat: 12.97, lng: 77.59 },
];
const BLR = STOPS[STOPS.length - 1];

const vec = (lat, lng) => {
  const p = lat * RAD, t = lng * RAD;
  return [Math.cos(p) * Math.sin(t), Math.sin(p), Math.cos(p) * Math.cos(t)];
};
const TILT = BLR.lat * RAD;
const CT = Math.cos(TILT), ST = Math.sin(TILT);

function project(v, ca, sa, cx, cy, R, out) {
  const x = v[0] * ca + v[2] * sa;
  const z = -v[0] * sa + v[2] * ca;
  const y2 = v[1] * CT - z * ST;
  out.x = cx + x * R;
  out.y = cy - y2 * R;
  out.z = v[1] * ST + z * CT;
  return out;
}

function slerp(a, b, t) {
  const d = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
  const w = Math.acos(d);
  if (w < 1e-5) return a.slice();
  const s = Math.sin(w);
  const k1 = Math.sin((1 - t) * w) / s, k2 = Math.sin(t * w) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

// ------------------------------------------------------------ globe points
export function makeGlobe(step) {
  const bin = atob(MASK_B64);
  const mask = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) mask[i] = bin.charCodeAt(i);
  const isLand = (lat, lng) => {
    let c = Math.floor(((lng + 180) / 360) * MASK_COLS);
    let r = Math.floor(((90 - lat) / 180) * MASK_ROWS);
    c = clamp(c, 0, MASK_COLS - 1);
    r = clamp(r, 0, MASK_ROWS - 1);
    const idx = r * MASK_COLS + c;
    return ((mask[idx >> 3] >> (7 - (idx & 7))) & 1) === 1;
  };
  const pts = [];
  for (let lat = -58; lat <= 82; lat += step) {
    const ring = Math.min(step / Math.cos(lat * RAD), 12);
    for (let lng = -180; lng < 180; lng += ring) if (isLand(lat, lng)) pts.push(vec(lat, lng));
  }
  // Order by screen x in the reference (hero) view so every arrangement can
  // be matched rank-for-rank: particles travel short, coherent paths.
  const ref = { x: 0, y: 0, z: 0 };
  const a0 = -BLR.lng * RAD;
  const ca = Math.cos(a0), sa = Math.sin(a0);
  pts.sort((p, q) => project(p, ca, sa, 0, 0, 1, ref).x - project(q, ca, sa, 0, 0, 1, { x: 0, y: 0, z: 0 }).x);
  const P = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => P.set(p, i * 3));

  const tmp = { x: 0, y: 0, z: 0 };
  const v = [0, 0, 0];
  return {
    n: pts.length,
    // Fill an arrangement from camera params. Back-hemisphere points are
    // placed but transparent, so they can fade in during a morph.
    fill(p, out, env, k) {
      const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
      const R = p.R * (1 + 5 * p.zoom * p.zoom);
      const asm = p.assemble; // {x, y, t} or null
      for (let i = 0; i < out.x.length; i++) {
        v[0] = P[i * 3]; v[1] = P[i * 3 + 1]; v[2] = P[i * 3 + 2];
        project(v, ca, sa, p.cx, p.cy, R, tmp);
        const depth = (tmp.z + 1) / 2;
        let a = tmp.z < -0.02 ? 0 : 0.16 + depth * 0.5;
        let x = tmp.x, y = tmp.y;
        if (asm) {
          const q = easeOut((asm.t - 200 - env.D[i] * 650) / 1050);
          x = lerp(asm.x + (env.D[i] - 0.5) * 6, x, q);
          y = lerp(asm.y + ((i % 7) - 3), y, q);
          a = q <= 0 ? 0 : lerp(0.9, a, q) * Math.min(1, q * 4);
        }
        out.x[i] = x;
        out.y[i] = y;
        out.a[i] = a;
        out.s[i] = 1.1 + depth * 2.1;
      }
    },
  };
}

// --------------------------------------------------------------- keyframes
// Hero: slow ambient spin, starting with Bengaluru facing the viewer.
export function heroKeyframe({ slotEl, cardEl, cursorEl, booting }) {
  const slot = new Slot(slotEl);
  let card = null, cursor = null, cardShown = null;
  const m = { x: 0, y: 0, z: 0 };
  const blr = vec(BLR.lat, BLR.lng);

  const k = {
    id: "hero", state: "s0", type: "globe",
    assembling: booting,
    layout(env) {
      slot.measure();
      this.anchor = 0;
      const sy = window.scrollY;
      if (cardEl && cardEl.offsetParent) {
        const r = cardEl.getBoundingClientRect();
        card = { x: r.left, docY: r.top + sy + r.height / 2, floating: window.innerWidth > 820 };
      }
      if (cursorEl) {
        const r = cursorEl.getBoundingClientRect();
        cursor = { x: r.left + r.width / 2, docY: r.top + sy + r.height / 2 };
      }
    },
    angle(env) {
      const t = env.reduce ? 0 : (env.now - env.t0) / 1000;
      return -BLR.lng * RAD + t * 0.09;
    },
    params(env) {
      const r = slot.at(env.y);
      let assemble = null;
      if (this.assembling && cursor) {
        const t = env.now - env.t0;
        if (t < 2000) assemble = { x: cursor.x, y: cursor.docY - env.y, t };
        else this.assembling = false;
      }
      return { cx: r.cx, cy: r.cy, R: r.w * 0.42, angle: this.angle(env), zoom: 0, assemble };
    },
    animated: () => true,
    overlay(ctx, w, env) {
      const p = this.params(env);
      const settle = p.assemble ? clamp((p.assemble.t - 900) / 700) : 1;
      const ww = w * settle;
      if (ww <= 0.01) return;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, p.R, 0, Math.PI * 2);
      ctx.strokeStyle = mint(0.1 * ww);
      ctx.stroke();
      ctx.save();
      ctx.translate(p.cx, p.cy);
      ctx.rotate(-0.42);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.R * 1.16, p.R * 0.4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = grey(0.1 * ww);
      ctx.setLineDash([2, 5]);
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);

      // Bengaluru marker, tracking its true position as the globe spins.
      project(blr, Math.cos(p.angle), Math.sin(p.angle), p.cx, p.cy, p.R, m);
      const vis = clamp((m.z - 0.05) / 0.22) * ww;
      const show = vis > 0.5 || (card && !card.floating);
      if (show !== cardShown && cardEl) {
        cardShown = show;
        cardEl.classList.toggle("is-hidden", !show);
      }
      if (vis < 0.01) return;
      if (card && card.floating) {
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(card.x, card.docY - env.y);
        ctx.strokeStyle = mint(0.45 * vis);
        ctx.stroke();
      }
      const pulse = env.reduce ? 0.6 : 0.5 + 0.5 * Math.sin(((env.now - env.t0) / 1000) * 2.2);
      ctx.beginPath();
      ctx.arc(m.x, m.y, 5 + pulse * 7, 0, Math.PI * 2);
      ctx.strokeStyle = mint((1 - pulse) * 0.5 * vis);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = mint(vis);
      ctx.fill();
    },
  };
  return k;
}

// s₁: the journey. Arcs draw across the stops; the globe turns to follow the
// arc head and ends facing Bengaluru.
export function journeyKeyframe({ slotEl, legendItems, stacked }) {
  let mobile = stacked();
  const slot = new Slot(slotEl);
  const V = STOPS.map((s) => vec(s.lat, s.lng));
  const SEG = V.length - 1;

  // Arc samples (with a little altitude) and the camera angle that follows
  // the head, unwrapped so it never spins the long way round.
  const SAMPLES = 64;
  const arcs = [];
  for (let s = 0; s < SEG; s++) {
    const pts = [];
    const span = Math.acos(clamp(V[s][0] * V[s + 1][0] + V[s][1] * V[s + 1][1] + V[s][2] * V[s + 1][2], -1, 1));
    for (let j = 0; j <= SAMPLES; j++) {
      const u = j / SAMPLES;
      const q = slerp(V[s], V[s + 1], u);
      const h = 1 + Math.sin(Math.PI * u) * Math.min(0.22, span * 0.12);
      pts.push([q[0] * h, q[1] * h, q[2] * h]);
    }
    arcs.push(pts);
  }
  const TABLE = 240;
  const angles = new Float32Array(TABLE + 1);
  let prev = null;
  for (let j = 0; j <= TABLE; j++) {
    const g = (j / TABLE) * SEG;
    const s = Math.min(SEG - 1, Math.floor(g));
    const q = slerp(V[s], V[s + 1], g - s);
    let a = -Math.atan2(q[0], q[2]);
    if (prev !== null) {
      let d = a - prev;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      a = prev + d;
    }
    angles[j] = prev = a;
  }
  // Settle exactly on Bengaluru.
  const end = angles[TABLE];
  const target = -BLR.lng * RAD;
  const fix = Math.atan2(Math.sin(target - end), Math.cos(target - end));
  for (let j = 0; j <= TABLE; j++) angles[j] += fix * (j / TABLE);

  const m = { x: 0, y: 0, z: 0 };
  let seenAt = 0, lit = -1;

  const k = {
    id: "journey", state: "s1", type: "globe",
    layout(env) {
      mobile = stacked();
      slot.measure();
      this.anchor = slot.centredAt();
    },
    // 0 → 1 as the arcs draw. Desktop: scroll-scrubbed over the approach.
    // Mobile: plays once on entry. Reduced motion: complete.
    progress(env) {
      if (env.reduce) return 1;
      if (mobile) {
        const r = slot.at(env.y);
        if (!seenAt && r.cy < env.vh * 0.75) seenAt = env.now;
        return seenAt ? easeInOut((env.now - seenAt) / 2600) : 0;
      }
      const a0 = this.prevAnchor ?? this.anchor - env.vh;
      return clamp((env.y - (a0 + (this.anchor - a0) * 0.35)) / ((this.anchor - a0) * 0.65));
    },
    params(env) {
      const r = slot.at(env.y);
      const p = this.progress(env);
      const idx = p * TABLE;
      const j = Math.min(TABLE - 1, Math.floor(idx));
      const angle = lerp(angles[j], angles[j + 1], idx - j);
      // Zoom into Bengaluru while morphing on to the chip.
      const zoom = env.A === this && env.B && env.B.type !== "globe" ? smooth(0, 0.7, env.b) : 0;
      return { cx: r.cx, cy: r.cy, R: r.w * 0.44, angle, zoom };
    },
    animated(env) {
      return mobile && this.progress(env) < 1;
    },
    overlay(ctx, w, env) {
      const prm = this.params(env);
      if (prm.zoom > 0.3) return;
      const ww = w * (1 - prm.zoom / 0.3);
      const ca = Math.cos(prm.angle), sa = Math.sin(prm.angle);
      const R = prm.R;
      const p = this.progress(env) * SEG;

      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(prm.cx, prm.cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = mint(0.1 * ww);
      ctx.stroke();

      // Arcs: completed ones dimmer, the live one bright with a head.
      for (let s = 0; s < SEG; s++) {
        const f = clamp(p - s);
        if (f <= 0) break;
        const pts = arcs[s];
        const last = Math.floor(f * SAMPLES);
        ctx.beginPath();
        let pen = false;
        for (let j = 0; j <= last; j++) {
          project(pts[j], ca, sa, prm.cx, prm.cy, R, m);
          if (m.z < -0.05) { pen = false; continue; }
          if (!pen) { ctx.moveTo(m.x, m.y); pen = true; } else ctx.lineTo(m.x, m.y);
        }
        ctx.strokeStyle = mint((f < 1 ? 0.9 : 0.45) * ww);
        ctx.lineWidth = f < 1 ? 1.4 : 1;
        ctx.stroke();
        if (f < 1) {
          project(pts[last], ca, sa, prm.cx, prm.cy, R, m);
          if (m.z > -0.05) {
            ctx.beginPath();
            ctx.arc(m.x, m.y, 2.6, 0, Math.PI * 2);
            ctx.fillStyle = mint(ww);
            ctx.fill();
          }
        }
      }

      // Stops and labels.
      ctx.font = "400 11px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.lineWidth = 1;
      let reached = -1;
      for (let s = 0; s < V.length; s++) {
        const on = p >= s - 0.001;
        if (on) reached = s;
        project(V[s], ca, sa, prm.cx, prm.cy, R, m);
        if (m.z < 0.02) continue;
        const vis = clamp((m.z - 0.02) / 0.15) * ww;
        const home = s === V.length - 1;
        ctx.beginPath();
        ctx.arc(m.x, m.y, home ? 3.5 : 2.4, 0, Math.PI * 2);
        ctx.fillStyle = on ? mint(vis) : grey(0.35 * vis);
        ctx.fill();
        if (home && on) {
          ctx.beginPath();
          ctx.arc(m.x, m.y, 9, 0, Math.PI * 2);
          ctx.strokeStyle = mint(0.4 * vis);
          ctx.stroke();
        }
        ctx.fillStyle = on ? grey(0.85 * vis) : grey(0.35 * vis);
        if (STOPS[s].left) {
          ctx.textAlign = "right";
          ctx.fillText(STOPS[s].name, m.x - 8, m.y + 14);
          ctx.textAlign = "left";
        } else ctx.fillText(STOPS[s].name, m.x + 8, m.y - 7);
      }
      if (reached !== lit && legendItems) {
        lit = reached;
        legendItems.forEach((li, i) => li.classList.toggle("is-lit", i <= reached));
      }
    },
  };
  return k;
}
