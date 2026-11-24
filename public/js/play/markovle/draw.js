// markovle drawing helpers, shared by the game view and the hub preview.
// View code: any maths is fine here; only the sim must be bit-exact.

export const COLORS = ["#59f3b0", "#f3c159", "#a99bff", "#ff8a7a"];
export const SHAPES = ["circle", "square", "triangle", "diamond"];

// Node layout in a unit box: triangle for 3 states, square for 4.
const LAYOUT = {
  3: [[0.5, 0.16], [0.16, 0.8], [0.84, 0.8]],
  4: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]],
};

export function nodePos(n, i, box) {
  const [u, v] = LAYOUT[n][i];
  return { x: box.x + u * box.w, y: box.y + v * box.h };
}

export function drawShape(ctx, kind, x, y, r) {
  ctx.beginPath();
  if (kind === "circle") ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (kind === "square") ctx.rect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76);
  else if (kind === "triangle") {
    ctx.moveTo(x, y - r * 1.1);
    ctx.lineTo(x + r * 1.05, y + r * 0.8);
    ctx.lineTo(x - r * 1.05, y + r * 0.8);
    ctx.closePath();
  } else {
    ctx.moveTo(x, y - r * 1.15);
    ctx.lineTo(x + r * 1.15, y);
    ctx.lineTo(x, y + r * 1.15);
    ctx.lineTo(x - r * 1.15, y);
    ctx.closePath();
  }
}

export function drawNode(ctx, i, x, y, r, { label = true, glow = 0 } = {}) {
  if (glow > 0) {
    ctx.save();
    ctx.shadowColor = COLORS[i];
    ctx.shadowBlur = 18 * glow;
    drawShape(ctx, SHAPES[i], x, y, r);
    ctx.fillStyle = COLORS[i];
    ctx.fill();
    ctx.restore();
  }
  drawShape(ctx, SHAPES[i], x, y, r);
  ctx.fillStyle = COLORS[i];
  ctx.fill();
  if (label && r >= 7) {
    ctx.fillStyle = "#050505";
    ctx.font = `600 ${Math.round(r * 1.05)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ABCD"[i], x, y + (SHAPES[i] === "triangle" ? r * 0.18 : 0.5));
  }
}

// Control point for an edge a→b: bowed to the right of the direction of
// travel, so a→b and b→a never overlap.
export function bend(a, b, k = 0.18) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  return { x: mx - dy * k, y: my + dx * k };
}

// Point on the quadratic a→c→b at t.
export const qAt = (a, c, b, t) => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});

// Self-loop circle centre for node i: pushed away from the layout centre.
export function loopCentre(n, i, box, r) {
  const p = nodePos(n, i, box);
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  let dx = p.x - cx, dy = p.y - cy;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  return { x: p.x + dx * r * 1.55, y: p.y + dy * r * 1.55, dx, dy };
}

/**
 * Draw a transition graph P (tenths) in `box`. Arrow width and opacity scale
 * with probability; zero-probability arrows are not drawn.
 */
export function drawChain(ctx, P, box, { r = 10, scale = 1, color = "242,242,242" } = {}) {
  const n = P.length;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const p = P[i][j] / 10;
      if (!p) continue;
      ctx.strokeStyle = ctx.fillStyle = `rgba(${color},${(0.28 + 0.72 * p).toFixed(3)})`;
      ctx.lineWidth = (0.6 + p * 5.2) * scale;
      if (i === j) {
        const c = loopCentre(n, i, box, r);
        ctx.beginPath();
        ctx.arc(c.x, c.y, r * 0.95, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      const a = nodePos(n, i, box), b = nodePos(n, j, box);
      const c = bend(a, b);
      // Trim both ends to the node radius, then draw the head at the end.
      const s = qAt(a, c, b, 0.14), e = qAt(a, c, b, 0.84);
      const ce = qAt(a, c, b, 0.49);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(2 * ce.x - (s.x + e.x) / 2, 2 * ce.y - (s.y + e.y) / 2, e.x, e.y);
      ctx.stroke();
      const t = qAt(a, c, b, 0.8);
      const ang = Math.atan2(e.y - t.y, e.x - t.x);
      const hl = (5 + p * 5) * scale;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(ang) * hl * 0.6, e.y + Math.sin(ang) * hl * 0.6);
      ctx.lineTo(e.x + Math.cos(ang + 2.5) * hl, e.y + Math.sin(ang + 2.5) * hl);
      ctx.lineTo(e.x + Math.cos(ang - 2.5) * hl, e.y + Math.sin(ang - 2.5) * hl);
      ctx.closePath();
      ctx.fill();
    }
  }
  for (let i = 0; i < n; i++) {
    const { x, y } = nodePos(n, i, box);
    drawNode(ctx, i, x, y, r);
  }
}

// Text description of a chain for screen readers.
export function describe(P) {
  const L = "ABCD";
  return P.map((row, i) =>
    row.map((v, j) => (v ? `${L[i]} to ${L[j]} ${(v / 10).toFixed(1)}` : null)).filter(Boolean).join(", "),
  ).join("; ");
}
