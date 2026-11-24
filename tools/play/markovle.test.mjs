// node --test tools/play/
import { test } from "node:test";
import assert from "node:assert/strict";
import { hash } from "../../public/js/motion/tokens.js";
import * as M from "../../public/js/play/markovle/sim.js";

const DAYS = 365;

// Fingerprint of a puzzle. Compare it with the value a browser computes (see
// docs/play/README.md); a mismatch means a cross-engine difference.
const fingerprint = (p) => hash(JSON.stringify(M.create(p).rounds));

test("same puzzle number gives the identical puzzle", () => {
  for (const p of [1, 2, 42, 365]) assert.deepEqual(M.create(p), M.create(p));
  assert.notDeepEqual(M.create(1).rounds, M.create(2).rounds);
});

test("puzzle #1 fingerprint is stable", () => {
  // If this changes, every player's puzzle changes. Only update it on purpose,
  // before launch.
  assert.equal(fingerprint(1), GOLDEN_1);
});

test(`${DAYS} puzzles are all valid and fair`, () => {
  for (let p = 1; p <= DAYS; p++) {
    const s = M.create(p);
    assert.equal(s.n, M.statesFor(p));
    assert.equal(s.rounds.length, M.ROUNDS);
    s.rounds.forEach((r, k) => {
      const where = `#${p} round ${k + 1}`;
      assert.equal(r.traj.length, M.LENGTHS[k], where);
      for (const P of r.candidates) for (const row of P) {
        assert.equal(row.reduce((a, b) => a + b, 0), 10, where + " row sums to 10");
        assert.ok(row.every((v) => Number.isInteger(v) && v >= 0), where);
      }
      assert.equal(r.candidates[r.answer], r.chain, where + " answer slot");
      const L = M.likelihood(r.chain, r.traj);
      const keys = new Set(r.candidates.map((P) => JSON.stringify(P)));
      assert.equal(keys.size, 4, where + " candidates distinct");
      let zeros = 0;
      r.candidates.forEach((D, i) => {
        if (i === r.answer) return;
        const l = M.likelihood(D, r.traj);
        if (l === 0) zeros++;
        assert.ok(L >= M.MARGIN * l, where + " margin");
      });
      assert.ok(zeros <= 1, where + " at most one ruled-out decoy");
      const visited = new Set(r.traj).size;
      assert.ok(visited >= (r.traj.length >= 16 ? s.n : s.n - 1), where + " visits states");
    });
  }
});

test("step, score and isOver follow the picks", () => {
  let s = M.create(5);
  const answers = s.rounds.map((r) => r.answer);
  assert.equal(M.isOver(s), false);
  s = M.step(s, { pick: answers[0] });
  s = M.step(s, { pick: (answers[1] + 1) % 4 });
  for (let k = 2; k < 5; k++) s = M.step(s, { pick: answers[k] });
  assert.equal(M.isOver(s), true);
  assert.equal(M.score(s), 4);
  assert.deepEqual(M.marks(s), [true, false, true, true, true]);
  assert.equal(M.step(s, { pick: 0 }), s, "no steps after the end");
  assert.equal(M.shareText(5, M.marks(s)), "markovle #5 4/5 🟩🟥🟩🟩🟩 markovstate.sh/play/markovle");
  assert.equal(M.tier(5), "stationary distribution");
  assert.equal(M.tier(0), "random walk");
});

test("intuition lines are plain sentences", () => {
  const s = M.create(9);
  for (const r of s.rounds) for (let i = 0; i < 4; i++) {
    const line = M.intuition(r, i);
    assert.match(line, /^(right|not quite)\. [A-D] → [A-D] is really \d\.\d; .+\.$/);
  }
});

const GOLDEN_1 = 3529827932;
