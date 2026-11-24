// Synthesized tones (spec §12). Off by default, never autoplayed, one global
// toggle whose state is remembered. The AudioContext is created on the first
// tone after the visitor has switched sound on, which is always a user gesture.

import { settings } from "./storage.js";

let ctx = null;
let on = settings.get("sound", false) === true;

const TONES = {
  start: [[440, 0, 0.08], [660, 0.08, 0.1]],
  tick: [[880, 0, 0.04]],
  good: [[660, 0, 0.08], [990, 0.08, 0.14]],
  bad: [[220, 0, 0.16]],
  finish: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.18]],
  hop: [[0, 0, 0.05]], // frequency supplied by the caller
};

export const soundOn = () => on;

export function setSound(v) {
  on = !!v;
  settings.set("sound", on);
  if (on) tone("tick");
}

export function tone(kind, freq) {
  if (!on) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime;
    for (const [f, at, len] of TONES[kind] || TONES.tick) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq || f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.08, t0 + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + len + 0.02);
    }
  } catch {}
}

// Wire a <button> as the global toggle.
export function bindToggle(btn) {
  const paint = () => {
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? "sound: on" : "sound: off";
  };
  paint();
  btn.addEventListener("click", () => {
    setSound(!on);
    paint();
  });
}
