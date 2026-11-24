// node --test tools/play/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { hash } from "../../public/js/motion/tokens.js";
import * as G from "../../public/js/play/lost-without-gps/sim.js";

const DAYS = 365;
// Typed arrays serialise as objects; turn them into plain arrays first.
const plain = (s) => JSON.stringify({ a: s.anchors, t: s.truth, u: s.turns, e: s.filter.est, c: s.filter.clouds.map((c) => [Array.from(c.x), Array.from(c.w)]) });
const fingerprint = (p) => hash(plain(G.create(p)));
// If this changes, every player's puzzle changes. Only update it on purpose,
// before launch.
const GOLDEN = 3059672235;

test("same puzzle number gives the identical puzzle and filter run", () => {
  for (const p of [1, 2, 42, 365]) assert.equal(plain(G.create(p)), plain(G.create(p)));
  assert.notEqual(plain(G.create(1)), plain(G.create(2)));
});

test("puzzle #1 fingerprint is stable", () => {
  assert.equal(fingerprint(1), GOLDEN);
});

test(`${DAYS} puzzles are well formed and the filter is credible`, () => {
  let sum = 0;
  for (let p = 1; p <= DAYS; p++) {
    const s = G.create(p);
    const where = `#${p}`;
    assert.equal(s.truth.length, G.TURNS + 1, where);
    for (const [x, y] of s.truth) assert.ok(x >= 0 && x <= G.W && y >= 0 && y <= G.H, where + " path on map");
    for (let t = 1; t <= G.TURNS; t++) {
      const d = Math.hypot(s.truth[t][0] - s.truth[t - 1][0], s.truth[t][1] - s.truth[t - 1][1]);
      assert.ok(d >= 3.4 && d <= 6.6, where + " step length");
    }
    const occl = s.turns.filter((t) => t.ranges.some((m) => m === null)).length;
    assert.equal(occl, 2, where + " two turns lose an anchor");
    assert.ok(s.turns[0].ranges.every(Boolean), where + " first turn has all anchors");
    for (const t of s.turns) for (const m of t.ranges) if (m) assert.ok(m.d > 0, where);
    const f = G.filterScore(s);
    assert.ok(f < 3.5, `${where} filter error ${f} m`);
    sum += f;
  }
  const mean = sum / DAYS;
  assert.ok(mean > 0.4 && mean < 1.6, `mean filter error ${mean.toFixed(2)} m`);
});

test("scoring: perfect guesses beat the filter on every turn", () => {
  let s = G.create(3);
  for (let t = 0; t < G.TURNS; t++) s = G.step(s, { x: s.truth[t + 1][0], y: s.truth[t + 1][1] });
  assert.equal(G.isOver(s), true);
  assert.equal(G.score(s), 0);
  assert.equal(G.beats(s), G.TURNS);
  assert.equal(G.step(s, { x: 1, y: 1 }), s, "no steps after the end");
});

test("scoring: guesses are clamped to the map and errors are in metres", () => {
  let s = G.create(4);
  s = G.step(s, { x: -50, y: 999 });
  assert.deepEqual(s.guesses[0], [0, G.H]);
  const [tx, ty] = s.truth[1];
  assert.ok(Math.abs(G.errors(s)[0] - Math.hypot(tx, ty - G.H)) < 1e-9);
});

test("share text carries only the result", () => {
  assert.equal(G.shareText(42, 3.84, 2), "lost-without-gps #42 · 3.8 m · beat the filter 2/8 · markovstate.sh/play/lost-without-gps");
});
