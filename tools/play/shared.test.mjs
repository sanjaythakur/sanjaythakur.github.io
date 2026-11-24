// node --test tools/play/
import { test } from "node:test";
import assert from "node:assert/strict";
import { LAUNCH_UTC, puzzleNumber, msUntilNext, countdown, streak, dailySeed } from "../../public/js/play/daily.js";
import { encode, decode } from "../../public/js/play/challenge.js";
import { store } from "../../public/js/play/storage.js";

const DAY = 86400000;

test("puzzle number rolls over at 00:00 UTC", () => {
  assert.equal(puzzleNumber(LAUNCH_UTC), 1);
  assert.equal(puzzleNumber(LAUNCH_UTC + DAY - 1), 1);
  assert.equal(puzzleNumber(LAUNCH_UTC + DAY), 2);
  assert.equal(puzzleNumber(LAUNCH_UTC + 41 * DAY + 5), 42);
  assert.equal(puzzleNumber(LAUNCH_UTC - 5 * DAY), 1, "never below 1");
});

test("countdown reaches the next UTC midnight", () => {
  assert.equal(msUntilNext(LAUNCH_UTC), DAY);
  assert.equal(msUntilNext(LAUNCH_UTC + DAY - 1000), 1000);
  assert.equal(countdown(LAUNCH_UTC + DAY - 3723000), "01:02:03");
});

test("streak counts back from today or yesterday", () => {
  assert.equal(streak({}, 5), 0);
  assert.equal(streak({ 3: 1, 4: 1, 5: 1 }, 5), 3);
  assert.equal(streak({ 3: 1, 4: 1 }, 5), 2, "today not played yet keeps the streak");
  assert.equal(streak({ 2: 1, 4: 1, 5: 1 }, 5), 2);
  assert.equal(streak({ 3: 1 }, 5), 0);
});

test("daily seeds differ per game and per day", () => {
  assert.notEqual(dailySeed("markovle", 1), dailySeed("markovle", 2));
  assert.notEqual(dailySeed("markovle", 1), dailySeed("drift", 1));
  assert.equal(dailySeed("markovle", 7), dailySeed("markovle", 7));
});

test("challenge links round-trip and reject junk", () => {
  for (const [seed, score] of [[0, 0], [1, 1284], [0xffffffff, 9999999], [123456789, 42]]) {
    assert.deepEqual(decode(encode(seed, score)), { seed, score });
  }
  for (const bad of [null, "", "abc", "zz.", ".12", "1.2.3", "zzzzzzzz.1", "1.-5", "<script>.1"]) {
    assert.equal(decode(bad), null, String(bad));
  }
});

test("storage falls back quietly when localStorage is unavailable", () => {
  const db = store("test");
  assert.equal(db.get("missing", 7), 7);
  assert.equal(typeof db.set("k", 1), "boolean");
});
