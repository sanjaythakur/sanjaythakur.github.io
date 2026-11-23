// s_T — terminal. Everything resolves into one lit node: the current state.

import { Slot } from "../field.js";

export function terminalKeyframe({ nodeEl }) {
  const slot = new Slot(nodeEl);
  return {
    id: "terminal", state: "sT", type: "points",
    layout() {
      slot.measure();
      const max = document.documentElement.scrollHeight - window.innerHeight;
      this.anchor = Math.min(max, slot.centredAt());
    },
    fill(out, env) {
      const r = slot.at(env.y);
      const N = env.N;
      const ring = Math.floor(N * 0.18);
      for (let i = 0; i < N; i++) {
        if (i < N - ring) {
          // Phyllotaxis disc: even density, reads as one solid node.
          const ang = i * 2.39996, rad = 6 * Math.sqrt(i / (N - ring));
          out.x[i] = r.cx + Math.cos(ang) * rad;
          out.y[i] = r.cy + Math.sin(ang) * rad;
          out.a[i] = 0.35;
          out.s[i] = 1.2;
        } else {
          const ang = ((i - (N - ring)) / ring) * Math.PI * 2;
          out.x[i] = r.cx + Math.cos(ang) * 18;
          out.y[i] = r.cy + Math.sin(ang) * 18;
          out.a[i] = 0.3;
          out.s[i] = 1;
        }
      }
    },
  };
}
