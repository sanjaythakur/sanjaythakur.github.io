// node --test tools/play/*.test.mjs
// The quick games: how-many (daily), echo and reflex (arcade).
import { test } from "node:test";
import assert from "node:assert/strict";
import { hash } from "../../public/js/motion/tokens.js";
import * as H from "../../public/js/play/how-many/sim.js";
import * as E from "../../public/js/play/echo/sim.js";
import * as R from "../../public/js/play/reflex/sim.js";

// Cross-engine fingerprints (see docs/play/README.md). If one changes, every
// player's puzzle or challenge link changes: only update it on purpose.
const GOLDEN_HOW_MANY_1 = 4106084052;
const GOLDEN_ECHO_12345 = 736946042;

// ---------- how many? ----------
const RANGES = [[12, 25], [30, 55], [60, 105], [115, 185], [195, 320]];

test("how-many: same puzzle number gives the identical puzzle", () => {
  for (const p of [1, 2, 42, 365]) assert.deepEqual(H.create(p), H.create(p));
  assert.notDeepEqual(H.create(1).rounds, H.create(2).rounds);
  assert.equal(hash(JSON.stringify(H.create(1).rounds)), GOLDEN_HOW_MANY_1);
});

test("how-many: two years of puzzles are well formed", () => {
  for (let p = 1; p <= 730; p++) {
    const s = H.create(p);
    assert.equal(s.rounds.length, H.ROUNDS);
    assert.ok(new Set(s.rounds.map((r) => r.layout)).size === 3 || s.rounds.length < 3, `#${p} every layout appears`);
    s.rounds.forEach((r, i) => {
      const where = `#${p} round ${i + 1}`;
      assert.equal(r.n, r.dots.length, where);
      // Crowded clumps can drop a few dots; the truth is what was placed.
      assert.ok(r.n >= RANGES[i][0] - 12 && r.n <= RANGES[i][1], `${where}: ${r.n}`);
      if (i) assert.ok(r.n > s.rounds[i - 1].n, `${where} grows`);
      for (const d of r.dots) {
        assert.ok(Number.isInteger(d.x) && Number.isInteger(d.y), where);
        assert.ok(d.x - d.r >= 0 && d.x + d.r <= H.W && d.y - d.r >= 0 && d.y + d.r <= H.H, where + " inside the field");
      }
      // No two dots overlap: every dot is countable in principle.
      for (let a = 0; a < r.dots.length; a++)
        for (let b = a + 1; b < r.dots.length; b++) {
          const A = r.dots[a], B = r.dots[b];
          assert.ok((A.x - B.x) ** 2 + (A.y - B.y) ** 2 >= (A.r + B.r) ** 2, where + " no overlap");
        }
    });
  }
});

test("how-many: guesses, scoring and share text", () => {
  assert.equal(H.parseGuess(" 1,204 "), 1204);
  assert.equal(H.parseGuess("0"), null);
  assert.equal(H.parseGuess("abc"), null);
  assert.equal(H.parseGuess("12.5"), null);
  assert.equal(H.parseGuess("99999"), null);
  let s = H.create(1);
  const ns = s.rounds.map((r) => r.n);
  for (const n of ns) s = H.step(s, { guess: n });
  assert.ok(H.isOver(s));
  assert.equal(H.score(s), 0);
  assert.equal(H.step(s, { guess: 5 }), s, "no guesses after the end");
  let t = H.create(1);
  for (const n of ns) t = H.step(t, { guess: Math.round(n * 1.2) });
  assert.ok(Math.abs(H.score(t) - 20) < 1.5, `about 20% off, got ${H.score(t)}`);
  assert.equal(H.grade(110, 100), 2);
  assert.equal(H.grade(125, 100), 1);
  assert.equal(H.grade(126, 100), 0);
  assert.equal(H.shareText(3, 12.5, [2, 1, 0, 2, 2]), "how many? #3 · 12.5% off · 🟩🟨🟥🟩🟩\nmarkovstate.sh/play/how-many.html");
});

// ---------- echo ----------
test("echo: the path is fixed by the seed and always moves", () => {
  assert.deepEqual(E.create(12345), E.create(12345));
  assert.equal(hash(JSON.stringify(E.create(12345).path)), GOLDEN_ECHO_12345);
  for (let seed = 0; seed < 500; seed++) {
    const { path } = E.create(seed * 7919);
    assert.equal(path.length, E.MAX);
    path.forEach((v, i) => {
      assert.ok(v >= 0 && v < E.N && Number.isInteger(v));
      if (i) assert.notEqual(v, path[i - 1], "a hop never stays put");
    });
  }
});

test("echo: repeating perfectly climbs levels; one wrong tap ends", () => {
  let s = E.create(99);
  for (let level = 1; level <= 6; level++) {
    assert.equal(s.level, level);
    const want = E.shown(s);
    assert.equal(want.length, level + 1);
    want.forEach((v, i) => {
      s = E.step(s, { tap: v });
      assert.equal(s.result, i === want.length - 1 ? "level" : "ok");
    });
  }
  assert.equal(E.score(s), 6);
  const wrong = (s.path[0] + 1) % 4;
  s = E.step(s, { tap: wrong });
  assert.equal(s.result, "wrong");
  assert.ok(E.isOver(s));
  assert.equal(E.score(s), 6, "score keeps the last finished level");
  assert.equal(E.step(s, { tap: 0 }).result, "ignored");
  assert.ok(E.hopMs(1) > E.hopMs(10) && E.hopMs(50) === 300);
});

// ---------- reflex ----------
test("reflex: waits are seeded and fair", () => {
  assert.deepEqual(R.create(5), R.create(5));
  for (const w of R.create(5).waits) assert.ok(w >= 1100 && w < 4000);
});

test("reflex: early, too-fast and slow taps replay the round", () => {
  let s = R.create(1);
  const w0 = R.nextWait(s);
  s = R.step(s, { early: true });
  assert.equal(s.result, "early");
  assert.notEqual(R.nextWait(s), undefined);
  assert.equal(s.times.length, 0);
  s = R.step(s, { ms: 40 });
  assert.equal(s.result, "early", "faster than humanly possible");
  s = R.step(s, { ms: 5000 });
  assert.equal(s.result, "slow");
  assert.equal(s.falseStarts, 3);
  for (const ms of [250, 230, 270, 240, 260]) s = R.step(s, { ms });
  assert.ok(R.isOver(s));
  assert.equal(R.score(s), 250);
  assert.equal(R.best(s), 230);
  assert.equal(R.step(s, { ms: 100 }).result, "ignored");
  void w0;
});
