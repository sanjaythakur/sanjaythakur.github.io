// s₄ — writing. Recent posts (from blogData.js) join the chain as nodes.

import { Slot } from "../field.js";
import { hash } from "../tokens.js";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Decorative transition probability, seeded from the post's file name.
const prob = (file) => "p=0." + (80 + (hash(file) % 19));

export function renderPosts(list, posts) {
  list.innerHTML = posts
    .map(
      (p, i) => `
      <li class="chain-row reveal" style="--i:${i}">
        <a class="chain-row__link glow" href="${esc(p.file)}">
          <span class="chain-row__node" aria-hidden="true"></span>
          <span class="chain-row__edge" aria-hidden="true"><span>${prob(p.file)}</span></span>
          <span class="chain-row__title">${esc(p.title)}</span>
          <span class="chain-row__cat">${esc(p.category.toLowerCase())}</span>
          <span class="chain-row__date">${esc(p.date)}</span>
          <span class="chain-row__arrow" aria-hidden="true">&rarr;</span>
        </a>
      </li>`
    )
    .join("");
}

export function writingKeyframe({ listEl }) {
  let nodes = [];
  let slot;
  return {
    id: "writing", state: "s4", type: "points",
    layout() {
      // Rows may still be mid-reveal (translated), so use layout offsets for
      // y, which ignore transforms. The node is vertically centred in its row.
      const docTop = (el) => {
        let y = 0;
        for (let e = el; e; e = e.offsetParent) y += e.offsetTop;
        return y;
      };
      nodes = [...listEl.querySelectorAll(".chain-row__node")].map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.left + r.width / 2, docY: docTop(n) + n.offsetHeight / 2 };
      });
      slot = new Slot(listEl).measure();
      this.anchor = slot.centredAt();
    },
    fill(out, env) {
      const N = env.N;
      if (!nodes.length) {
        for (let i = 0; i < N; i++) { out.x[i] = env.vw / 2; out.y[i] = env.vh / 2; out.a[i] = 0; out.s[i] = 1; }
        return;
      }
      const top = nodes[0].docY - env.y, bot = nodes[nodes.length - 1].docY - env.y;
      const x = nodes[0].x;
      const nodeN = Math.floor(N * 0.3);
      const per = Math.floor(nodeN / nodes.length);
      let i = 0;
      // Nodes: tight discs that read as solid dots.
      nodes.forEach((n, j) => {
        for (let k = 0; k < per; k++, i++) {
          const ang = k * 2.39996, rad = 4.2 * Math.sqrt(k / per);
          out.x[i] = n.x + Math.cos(ang) * rad;
          out.y[i] = n.docY - env.y + Math.sin(ang) * rad;
          out.a[i] = 0.5;
          out.s[i] = 1.2;
        }
      });
      // The rest: the chain itself, a dim vertical line through the nodes.
      const rest = N - i;
      for (let k = 0; i < N; k++, i++) {
        out.x[i] = x;
        out.y[i] = top + ((bot - top) * k) / Math.max(1, rest - 1);
        out.a[i] = 0.06;
        out.s[i] = 1;
      }
    },
  };
}
