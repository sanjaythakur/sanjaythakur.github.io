// node --test tools/play/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as D from "../../public/js/play/drift/sim.js";
import { encode, decode } from "../../public/js/play/challenge.js";
import { run, oracle, naive, skilled, reachable } from "./drift-bots.mjs";

const SEEDS = Array.from({ length: 60 }, (_, i) => ((i + 1) * 2654435761) >>> 0);

test("a run replays exactly from its seed and input log", () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const live = run(seed, skilled());
    const again = D.replay(seed, live.toggles);
    assert.equal(again.tick, live.s.tick, "same crash tick");
    assert.equal(again.x, live.s.x);
    assert.equal(again.y, live.s.y);
    assert.equal(D.score(again), live.m);
  }
});

test("the course and the drift do not depend on the player", () => {
  // Two different pilots on one seed meet identical walls and beacons.
  const a = run(SEEDS[3], naive).s, b = run(SEEDS[3], oracle).s;
  const upTo = Math.min(a.x, b.x);
  for (let x = 0; x < upTo; x += 37) assert.deepEqual(D.corridorAt(a, x), D.corridorAt(b, x));
  const n = Math.min(a.beacons.length, b.beacons.length);
  for (let i = 0; i < n; i++) assert.equal(a.beacons[i].x, b.beacons[i].x);
});

test("golden run: a fixed seed and pilot always score the same", () => {
  // If this changes, every challenge link already sent changes course.
  // Only update it on purpose, before launch.
  const r = run(123456789, skilled());
  assert.deepEqual([r.m, r.s.tick, r.s.fixes], GOLDEN);
});

test("every course is geometrically passable", () => {
  for (const seed of [...SEEDS, ...Array.from({ length: 140 }, (_, i) => (i * 40503 + 17) >>> 0)]) {
    assert.equal(reachable(seed, 4000), Infinity, `seed ${seed}`);
  }
});

test("a pilot with perfect information goes far", () => {
  const ms = SEEDS.map((s) => run(s, oracle, D.HZ * 240).m).sort((a, b) => a - b);
  assert.ok(ms[ms.length >> 1] >= 2400, `oracle median ${ms[ms.length >> 1]} m`);
});

test("skill pays: compensating for drift beats ignoring it", () => {
  const med = (bot) => {
    const ms = SEEDS.map((s) => run(s, bot()).m).sort((a, b) => a - b);
    return ms[ms.length >> 1];
  };
  const n = med(() => naive), k = med(skilled);
  assert.ok(n >= 150 && n <= 1200, `naive median ${n} m`);
  assert.ok(k >= 2 * n, `skilled ${k} m vs naive ${n} m`);
});

test("beacons reset the bias; the ghost fades with it", () => {
  const s = D.create(7);
  s.bias = D.GHOST_FADE / 2;
  assert.equal(D.ghostAlpha(s), 0.5);
  s.bias = -D.GHOST_FADE * 2;
  assert.equal(D.ghostAlpha(s), 0);
  const { s: done } = run(SEEDS[0], oracle, D.HZ * 60);
  assert.ok(done.fixes > 0, "the oracle collects fixes");
});

test("challenge links carry the seed and score", () => {
  const link = encode(0xdeadbeef, 1284);
  assert.deepEqual(decode(link), { seed: 0xdeadbeef, score: 1284 });
  assert.equal(D.shareText(1284, "markovstate.sh/play/drift.html?c=" + link), `I drifted 1,284 m before my IMU betrayed me. beat it: markovstate.sh/play/drift.html?c=${link}`);
});

const GOLDEN = [1602,9349,11];
