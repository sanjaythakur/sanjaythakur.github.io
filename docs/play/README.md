# `/ i'm bored`: maintainer notes

This file covers how the games section on markovstate.sh works and how to change it:

- the brief is [`specifications/games.md`](../../specifications/games.md);
- the approved design, with the numbers each game was tuned to, is [`CONCEPT.md`](CONCEPT.md);
- the motion system it builds on is described in [`docs/motion/README.md`](../motion/README.md).

The section follows the same rules as the rest of the site:

- static files in `public/`;
- no build step and no dependencies;
- no server;
- no request of any kind once a page has loaded.

## File map

| File | What it does |
|---|---|
| `public/play/index.html` | The hub. Its cards are static HTML, so the list still works without JS. |
| `public/play/<slug>.html` | One page per game. It copies the site header, nav, footer and nav-toggle script, uses `data-page="play"` and has a `#playHud` host. |
| `public/play/play.css` | Styles for the hub and the game pages, built on `theme.css` tokens. |
| `public/js/play/games.js` | **The registry**: the single list of games. The hub, "play another", `surprise me` and the HUD all read from it. |
| `public/js/play/shell.js` | Shared chrome for the HUD, the sound toggle and the live region. Also builds the end screen (one primary CTA, a quiet secondary row, play again), "play another", the daily countdown and history, and `bringIntoView`. It imports `site.js`. |
| `public/js/play/storage.js` | The `localStorage` wrapper. Every call is wrapped in try/catch and falls back to defaults. |
| `public/js/play/daily.js` | Holds `LAUNCH_UTC` and works out the puzzle number, countdown, daily seed and streak. Pure. |
| `public/js/play/challenge.js` | Encodes and decodes challenge links. Pure. |
| `public/js/play/share.js` | Shares through the Web Share API on touch devices and falls back to the clipboard. |
| `public/js/play/audio.js` | Synthesized Web Audio tones. Sound is off by default and has one global toggle. |
| `public/js/play/previews.js` | Small static drawing of each game, used by the hub cards and the OG cards. |
| `public/js/play/hub.js` | The hub page: previews, today's status, `surprise me`. |
| `public/js/play/<slug>/sim.js` | The game's rules. No DOM, so it runs under Node. |
| `public/js/play/<slug>/view.js` | Rendering, input and flow for one game. |
| `public/js/play/markovle/draw.js` | Chain drawing, shared by the `markovle` view and the hub preview. |
| `tools/play/*.test.mjs` | Headless tests. Never deployed. |
| `tools/play/drift-bots.mjs` | Autopilots and the reachability check used to tune and test `drift`. |
| `tools/og/card.html`, `render.sh` | OG cards, including `play.png` and `play-<slug>.png`. |

## The sim/view split

Each game's rules live in `sim.js` and import nothing from the DOM. The interface is roughly:

- `create(seedOrPuzzle)`
- `step(state, action)`
- `score(state)`
- `isOver(state)`

`view.js` owns the canvas, input, timing, storage and the end screen.

Rule 4 in spec §6 applies to every `sim.js`: the same seed must give the same game in every browser. To keep it:

- **Allowed:** `+ − × ÷`, `Math.sqrt` and integer operations.
- **Not allowed:** `Math.sin`, `cos`, `exp`, `log`, or `pow` with a non-integer result. Their last bits differ between JS engines. Put directions and rotations in literal tables, as `lost-without-gps` does.
- **Randomness** comes only from `rng()`/`hash()` in `tokens.js`. Draw Gaussian-like noise as a sum of uniforms.
- **Draw from seeded streams in a fixed order.** If draws can happen in a different order depending on the player, split them into separate streams. `drift` uses three: corridor, beacons and drift. That way the course never depends on how someone flies.
- **`view.js` is exempt.** It may use any maths.

## Seeding

| Kind | Seed |
|---|---|
| Daily | `hash("markovstate:<slug>:<puzzleNumber>")` via `dailySeed()`. Puzzle #1 is `LAUNCH_UTC`; the number goes up at 00:00 UTC. |
| Arcade | A random `uint32` from `crypto.getRandomValues`, or the seed in `?c=` when the page is opened from a challenge link. |

**Before launch, set `LAUNCH_UTC` in `public/js/play/daily.js` to the launch date.** After launch, never change it: that would renumber every puzzle and break every streak.

## Adding a game

1. Add an entry to `GAMES` in `games.js` with `status: "soon"`. The fields are:
   - `slug`, `title`, `hook`, `rule`;
   - `type` (`daily` / `arcade` / `toy`), `time`, `daily`;
   - `hud` (a short node label);
   - `cta` (`kind`, `copy`, `href`);
   - `post`.
2. Write `public/js/play/<slug>/sim.js` and a test in `tools/play/<slug>.test.mjs`. The test should check that:
   - the same seed gives identical output;
   - a year of seeds is valid;
   - scoring is correct;
   - a fingerprint of puzzle #1 or a golden run matches a stored value.
3. Copy `public/play/markovle.html` to `public/play/<slug>.html`. Change the title, the meta and OG tags, the `<main>` body and the module path.
4. Write `view.js`. Call `mountGamePage(slug)` and use `renderEnd()` for the end screen. Call `bringIntoView()` when a round starts. Save results as `{ …, label }` so the hub can show them.
5. Add a preview function to `previews.js`, and add a card to `public/play/index.html` as a `div.card.is-soon`.
6. Run `sh tools/og/render.sh play` and add the `og:image` tags to the new page.
7. When it's ready, set `status: "live"` and turn the hub card into an `<a class="card glow reveal">`.

## Storage keys

Every key is `markovstate:play:<slug>:<key>`, and the value is JSON.

| Slug | Key | Value |
|---|---|---|
| `_` | `sound` | `true` / `false` |
| `markovle` | `results` | `{ [puzzle]: { m: [1,0,1,1,1], ms, label } }` |
| `markovle` | `progress` | `{ puzzle, picks, ms }` while a puzzle is in progress, otherwise `null` |
| `markovle` | `best` | `{ s, ms }` |
| `lost-without-gps` | `results` | `{ [puzzle]: { err, filt, beat, g: [[x,y]…], label } }` |
| `lost-without-gps` | `progress` | `{ puzzle, g }` while a puzzle is in progress, otherwise `null` |
| `lost-without-gps` | `best` | the best mean error in metres |
| `drift` | `runs` | the top 5 `[{ m, d: "YYYY-MM-DD" }]`, best first |
| `drift` | `lastPlayed` | the puzzle number of the day of the last run, used by `surprise me` |

A finished daily puzzle shows its result on reload instead of letting you play it again.

## Challenge links

The format is `drift.html?c=<seed in base36>.<metres>`, for example `?c=1tbbci.7`.

- `challenge.js` checks the format strictly: up to 7 base-36 characters, a dot, then up to 7 digits. Anything else is ignored, and the page falls back to a random course.
- The score in the link is a claim, not a verified result. That is fine between friends, and it is why there is no public ranking.
- Daily games need no link. Everyone has the same puzzle, so the share text is the challenge.

## Testing

Run the headless tests from the repo root:

```sh
node --test tools/play/*.test.mjs
```

Node 22 needs the file glob; it won't take a directory. The tests check:

- `markovle`: 365 puzzles are valid, and the true chain is always at least 3× as likely as each decoy;
- `lost-without-gps`: 365 puzzles are well formed, and the filter's error stays credible;
- `drift`: recorded runs replay exactly, 200 courses are passable to 4 km, and compensating for drift beats ignoring it;
- shared modules: daily rollover, streaks, challenge-link round trips, and storage fallbacks.

To tune `drift`, run `node tools/play/drift-bots.mjs`. It prints the distances reached by four autopilots. The tuned values are in CONCEPT §3.3.

**Checking another browser (Firefox and Safari).** The Node tests run on V8, the same engine as Chrome. To confirm another engine builds the same puzzles:

1. Serve `public/`.
2. Open `/play/` in the browser.
3. Paste this into its console:

```js
const [T, M, G] = await Promise.all([import("/js/motion/tokens.js"), import("/js/play/markovle/sim.js"), import("/js/play/lost-without-gps/sim.js")]);
const g = G.create(1);
[T.hash(JSON.stringify(M.create(1).rounds)),
 T.hash(JSON.stringify({ a: g.anchors, t: g.truth, u: g.turns, e: g.filter.est, c: g.filter.clouds.map((c) => [Array.from(c.x), Array.from(c.w)]) }))]
```

The result must be `[3529827932, 3059672235]`, the `GOLDEN` values in the tests. For `drift`, open the same `?c=` link in two browsers and check that the course matches.

## Release checklist

- [ ] `LAUNCH_UTC` set to the launch date.
- [ ] `node --test tools/play/*.test.mjs` passes.
- [ ] Firefox and Safari return the fingerprints above.
- [ ] Play each game on a real iPhone and Android phone, held upright: touch, hold-to-fly, share sheet.
- [ ] Lighthouse mobile on Home, one post, the hub and each game. Target: performance ≥ 95, CLS 0, no regression from the numbers in `docs/motion/README.md`.
- [ ] `sh tools/og/render.sh play` re-run if a title, hook or preview changed.

## Content the backlog games need from the owner

None of these is built. Each needs material only the owner can write. Samples must be synthetic: no real children's work or handwriting.

| Game | Needs |
|---|---|
| `spot-the-hallucination` | About 60 short claims, enough for roughly 2 months of dailies at 8 a day. About a third should be plausible fabrications. Each needs a true/false label and a one-line source or correction. Ties to "Battle-Tested Mental Models for Reliable LLMs". |
| `tutor-turing-test` | About 30 child-level questions, each with one human tutor reply and one AI reply, plus the reveal line. Needs `posts/ai-tutor-turing-test.html` finished and listed in `blogData.js` first. |
| `grade-it` | About 20 synthetic handwritten short answers as images, each with a rubric, the owner's grade and the AI grader's grade. Ties to the handwritten-evaluation post. |
