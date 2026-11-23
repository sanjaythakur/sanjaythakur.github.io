// Generative post headers (SPEC §8.1).
// Deterministic: seeded from the post slug, family chosen by category.
// Draws a short 1–2 s sequence, then settles on a still frame (t = 1).
// The same drawer renders the static previews on the blog index.

import { rng, hash, clamp, easeOut, easeInOut, mint, grey, fitCanvas, reducedMotion, DUR } from "./tokens.js";

export function familyFor(category = "") {
  const c = category.toLowerCase();
  if (/\bai\b/.test(c)) return "graph";
  if (c.includes("defence") || c.includes("defense")) return "radar";
  if (c.includes("education")) return "wave";
  return "chain";
}

export const slugOf = (file) => file.split("/").pop().replace(/\.html$/, "");

const FONT = "400 10.5px 'IBM Plex Mono', ui-monospace, monospace";

// ------------------------------------------------------------------ graph
// A layered state graph; one path through it lights up in mint.
function graph(ctx, w, h, r, t) {
  const L = 5 + Math.floor(r() * 2);
  const padX = w * 0.06, padY = h * 0.18;
  const layers = [];
  for (let i = 0; i < L; i++) {
    const n = i === 0 || i === L - 1 ? 1 : 2 + Math.floor(r() * 3);
    const x = padX + ((w - 2 * padX) * i) / (L - 1);
    layers.push(Array.from({ length: n }, (_, j) => ({
      x: x + (r() - 0.5) * w * 0.03,
      y: n === 1 ? h / 2 : padY + ((h - 2 * padY) * (j + 0.5)) / n + (r() - 0.5) * h * 0.06,
    })));
  }
  const path = layers.map((l) => Math.floor(r() * l.length));
  const edges = [];
  for (let i = 0; i < L - 1; i++)
    layers[i].forEach((a, ia) =>
      layers[i + 1].forEach((b, ib) => {
        const on = path[i] === ia && path[i + 1] === ib;
        if (on || r() < 0.45) edges.push({ a, b, i, on, p: (0.6 + r() * 0.39).toFixed(2) });
      })
    );
  ctx.lineWidth = 1;
  edges.forEach((e) => {
    const k = clamp(t * (L - 1) - e.i);
    if (k <= 0) return;
    const mx = (e.a.x + e.b.x) / 2;
    ctx.beginPath();
    ctx.moveTo(e.a.x, e.a.y);
    // Partial bezier via sampling, so edges stroke-draw left to right.
    const steps = 24;
    for (let s = 1; s <= steps * k; s++) {
      const u = s / steps, v = 1 - u;
      const x = v * v * v * e.a.x + 3 * v * v * u * mx + 3 * v * u * u * mx + u * u * u * e.b.x;
      const y = v * v * v * e.a.y + 3 * v * v * u * e.a.y + 3 * v * u * u * e.b.y + u * u * u * e.b.y;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = e.on ? mint(0.75) : grey(0.13);
    ctx.stroke();
    if (e.on && k >= 1 && w > 300) {
      ctx.font = FONT;
      ctx.fillStyle = grey(0.32);
      ctx.fillText("p=" + e.p, mx - 14, (e.a.y + e.b.y) / 2 - 6);
    }
  });
  layers.forEach((l, i) =>
    l.forEach((n, j) => {
      const k = clamp(t * (L - 1) - i + 0.5);
      if (k <= 0) return;
      const on = path[i] === j;
      ctx.beginPath();
      ctx.arc(n.x, n.y, on ? 3.6 : 2.6, 0, Math.PI * 2);
      ctx.fillStyle = on ? mint(k) : "#050505";
      ctx.fill();
      ctx.strokeStyle = on ? mint(k) : grey(0.3 * k);
      ctx.stroke();
    })
  );
  // The current state: last node on the path, ringed.
  const last = layers[L - 1][0];
  const ring = easeOut((t - 0.85) / 0.15);
  if (ring > 0) {
    ctx.beginPath();
    ctx.arc(last.x, last.y, 9, 0, Math.PI * 2);
    ctx.strokeStyle = mint(0.45 * ring);
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ radar
function radar(ctx, w, h, r, t) {
  const cx = w * (0.68 + r() * 0.12), cy = h * 0.55, R = Math.max(w, h) * 0.55;
  ctx.lineWidth = 1;
  for (let k = 1; k <= 5; k++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (R * k) / 5, 0, Math.PI * 2);
    ctx.strokeStyle = grey(k === 5 ? 0.06 : 0.09);
    ctx.stroke();
  }
  ctx.strokeStyle = grey(0.07);
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
  ctx.stroke();

  // Trajectories: shallow arcs inbound from the left.
  const tr = Array.from({ length: 3 }, () => ({
    x0: -10, y0: h * (0.15 + r() * 0.7), cx: w * (0.2 + r() * 0.3), cy: h * (r() * 1), x1: cx - R * (0.15 + r() * 0.3), y1: cy + (r() - 0.5) * h * 0.4,
  }));
  ctx.setLineDash([2, 4]);
  tr.forEach((p) => {
    const k = easeInOut(t);
    ctx.beginPath();
    for (let s = 0; s <= 40 * k; s++) {
      const u = s / 40, v = 1 - u;
      const x = v * v * p.x0 + 2 * v * u * p.cx + u * u * p.x1;
      const y = v * v * p.y0 + 2 * v * u * p.cy + u * u * p.y1;
      s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = grey(0.28);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // One sweep, then hold.
  const a0 = -Math.PI / 2;
  const sweep = a0 + easeInOut(t) * Math.PI * 2 * 0.92;
  const grad = 0.55;
  for (let k = 0; k < 14; k++) {
    const a = sweep - (grad * k) / 14;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a - grad / 14, a);
    ctx.closePath();
    ctx.fillStyle = mint(0.07 * (1 - k / 14));
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
  ctx.strokeStyle = mint(0.6);
  ctx.stroke();

  // Contacts light up once the sweep passes them.
  for (let k = 0; k < 7; k++) {
    const a = a0 + r() * Math.PI * 2 * 0.92, d = R * (0.2 + r() * 0.7);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    if (x < 0 || x > w || y < 0 || y > h || a > sweep) continue;
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = mint(0.85);
    ctx.fill();
  }
}

// ------------------------------------------------------------------- wave
// A voice waveform resolving into a handwritten stroke.
function wave(ctx, w, h, r, t) {
  const B = Math.max(20, Math.floor(w / 14));
  const split = w * 0.5;
  const mid = h * 0.52;
  const k1 = easeOut(t / 0.55);
  for (let i = 0; i < B; i++) {
    const x = w * 0.05 + ((split - w * 0.1) * i) / B;
    const u = i / B;
    const env = Math.sin(Math.PI * u) * (0.35 + r() * 0.65);
    const bh = Math.max(1.5, env * h * 0.36 * clamp(k1 * 1.6 - u * 0.6));
    ctx.fillStyle = mint(0.25 + env * 0.55);
    ctx.fillRect(x, mid - bh, 2, bh * 2);
  }
  // Ruled line under the writing.
  ctx.fillStyle = grey(0.12);
  ctx.fillRect(split, mid + h * 0.16, w * 0.44, 1);
  // Cursive-like loops (prolate trochoid), seeded.
  const k2 = easeInOut((t - 0.35) / 0.65);
  if (k2 <= 0) return;
  const a = 3 + r() * 1.5, b = 6 + r() * 3, c = h * (0.13 + r() * 0.05);
  const loops = 6 + Math.floor(r() * 4);
  const steps = 160;
  ctx.beginPath();
  for (let s = 0; s <= steps * k2; s++) {
    const u = (s / steps) * loops * Math.PI * 2;
    const x = split + w * 0.03 + a * u - b * Math.sin(u) * 0.9;
    const y = mid + h * 0.04 - c * Math.cos(u) * (0.7 + 0.3 * Math.sin(u * 0.37));
    s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    if (x > w * 0.95) break;
  }
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.strokeStyle = grey(0.85);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.lineWidth = 1;
}

// ------------------------------------------------------------------ chain
// A minimal Markov chain: a few states, self-loops, one transition pulse.
function chain(ctx, w, h, r, t) {
  const n = 3 + Math.floor(r() * 2);
  const y = h * 0.55;
  const xs = Array.from({ length: n }, (_, i) => w * 0.14 + ((w * 0.72) * i) / (n - 1));
  const cur = Math.floor(r() * n);
  ctx.lineWidth = 1;
  for (let i = 0; i < n - 1; i++) {
    const k = clamp(t * 2 - i * 0.3);
    if (k <= 0) continue;
    const x0 = xs[i] + 8, x1 = xs[i] + 8 + (xs[i + 1] - xs[i] - 16) * k;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo((x0 + x1) / 2, y - h * 0.22 * k, x1, y);
    ctx.strokeStyle = grey(0.25);
    ctx.stroke();
    if (w > 300 && k >= 1) {
      ctx.font = FONT;
      ctx.fillStyle = grey(0.32);
      ctx.fillText("p=" + (0.5 + r() * 0.49).toFixed(2), (xs[i] + xs[i + 1]) / 2 - 18, y - h * 0.14);
    }
  }
  xs.forEach((x, i) => {
    ctx.beginPath();
    ctx.ellipse(x, y + 16, 7, 9, 0, Math.PI * 0.15, Math.PI * 0.85, true);
    ctx.strokeStyle = grey(0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, i === cur ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = i === cur ? mint(easeOut((t - 0.6) / 0.4) * 0.7 + 0.3) : "#050505";
    ctx.fill();
    ctx.strokeStyle = i === cur ? mint(1) : grey(0.4);
    ctx.stroke();
  });
}

const FAMILIES = { graph, radar, wave, chain };

/**
 * Draw one frame. `t` ∈ [0, 1]; 1 is the settled still.
 */
export function drawHeader(ctx, w, h, { slug, category, t = 1, labels = true }) {
  const fam = familyFor(category);
  const seed = hash(slug);
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  FAMILIES[fam](ctx, w, h, rng(seed), clamp(t));
  ctx.restore();
  if (labels) {
    ctx.font = FONT;
    ctx.fillStyle = grey(0.38);
    ctx.fillText("~/posts/" + slug, 0, h - 4);
    const tag = fam + " · seed 0x" + seed.toString(16).padStart(8, "0");
    ctx.fillText(tag, w - ctx.measureText(tag).width, h - 4);
  }
}

// Mount the animated header on a post page.
export function mountPostHeader(host, post) {
  const canvas = host.querySelector("canvas");
  if (!canvas || !post) return;
  const slug = slugOf(post.file);
  let size;
  const render = (t) => drawHeader(size.ctx, size.w, size.h, { slug, category: post.category, t });
  const resize = () => {
    size = fitCanvas(canvas);
    render(1);
  };
  size = fitCanvas(canvas);
  if (reducedMotion()) {
    render(1);
  } else {
    const start = performance.now();
    const dur = DUR.hero;
    const step = (now) => {
      const t = (now - start) / dur;
      render(t);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(resize, 150);
  });
}
