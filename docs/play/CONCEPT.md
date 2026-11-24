# `/ i'm bored`: concept (Phase 1)

| | |
|---|---|
| **Status** | Approved 2026-11-24 and built on `feat/play`. Maintainer notes: [`README.md`](README.md). |
| **Branch** | `feat/play` |
| **Spec** | [`specifications/games.md`](../../specifications/games.md) |
| **Written** | 2026-11-24 |

This document is the Phase 1 deliverable from spec §18. It contains:

- the audit of the repo,
- the final rules and numbers for the three launch games,
- end-screen sketches,
- the changes this proposes to the spec,
- the open questions.

Approve it, or mark it up, before Phase 2 starts.

---

## 1. Baseline

Lighthouse is not installed on this machine. The most recent recorded scores are in [`docs/motion/README.md`](../motion/README.md#before--after-lighthouse-mobile-local-server-2026-11-23), taken on 2026-11-23:

- Home: 100 / 100 / 100 / 100, CLS 0
- be-a-markov-state: 99 / 98 / 100 / 100, CLS 0

These are the numbers to check against at the end.

Gzipped JS measured today, on the branch before any change:

| Module | Gzipped |
|---|---|
| `tokens.js` | 1,379 B |
| `site.js` | 1,675 B |
| `hud.js` | 2,836 B |
| `field.js` | 3,171 B |
| `home.js` | 1,999 B |
| `post.js` | 2,028 B |
| `post-header.js` | 3,490 B |
| `blogData.js` | 1,455 B |

The only change outside `js/play/` that touches home or post JS is the one array entry added to `hud.js` (§4.4). It adds about 30 B.

## 2. Menu label

The label is **`I'm Bored`**. It is the fifth item, after `Blog Posts`, and links to `play/` (`../play/` from posts).

The alternatives are `./play`, `Take a Break` and `Kill 2 Minutes`. `./play` is the strongest of them: it is short, fits the terminal voice and needs the least width. Use it if five items turn out to be cramped at about 900 px.

## 3. Launch games: final rules

### 3.1 `markovle`

| | |
|---|---|
| States | 3 on puzzles where `n % 3 == 0`, otherwise 4. Labels `A B C D`, each with its own shape (● ■ ▲ ◆) as well as a colour. |
| Probabilities | Multiples of 0.1. Every row sums to exactly 10 tenths. Integers are used internally. |
| Rounds | 5 per day. Trajectory lengths are 24, 20, 16, 13 and 10 steps. |
| Candidates | 4 graphs, shuffled. Arrow width scales with probability, and an arrow is hidden when p = 0. |
| Distractors | Move 1–3 tenths between two entries in one or two rows of the true chain. Reject the set if two candidates are identical. Also reject it if the trajectory's likelihood under the true chain is not at least **3×** its likelihood under every distractor. Likelihoods are plain products of tenths, with at most 24 factors, so there is no `log`. On rejection, draw the next distractor from the same RNG stream, so the result stays deterministic. |
| Score | Rounds correct out of 5, then total time. |
| Tiers | 5 is `stationary distribution`, 4 is `well mixed`, 3 is `burn-in`, 0–2 is `random walk`. |
| After each answer | Show the true graph and a one-line intuition. The line is picked automatically from the largest gap between true and chosen chain, e.g. "B → B was 0.6, not 0.1: B kept repeating". |

```
┌ markovle #42 ──────────────────────────────┐
│  4/5 · well mixed · 1:12                   │
│  🟩 🟩 🟥 🟩 🟩                              │
│                                            │
│  [ >> the chain doesn't remember.          │
│       should you? read the post → ]        │  ← primary, mint, full width
│                                            │
│  share · follow on x · play another        │
│  next puzzle in 07:12:09                   │
│  ▢▢■■□■■  last 7 days · streak 3           │
└────────────────────────────────────────────┘
```

### 3.2 `lost-without-gps`

| | |
|---|---|
| World | 60 × 40 m, drawn dark with a faint 5 m grid. |
| Anchors | 3 UWB anchors placed by the seed. A placement is rejected if the triangle area is under 300 m² or any angle is under 25°. |
| Vehicle | 8 turns. Each step is 3.5–6.5 m, with the heading taken from a 16-entry lookup table. The heading changes by at most ±2 table steps per turn, and the path bounces off a 4 m margin. |
| Ranges | True distance plus noise with σ = 0.5 m, where Gaussian noise is the sum of 12 uniforms minus 6. With probability 0.15 a range is NLOS and gets an extra +1.5 to +5 m. On 2 of the 8 turns one anchor is occluded, leaving 2 rings and an ambiguity that the IMU resolves. |
| IMU | Reported step = true step × (1 + scale error), rotated by an accumulated heading bias. The scale error is ±4–8%, fixed per puzzle. The bias grows by one table step every 3 turns, so dead reckoning gets steadily worse, as it does in reality. |
| Input | Tap or click a guess, then confirm. The keyboard alternative moves a reticle with the arrows (Shift for 5 m steps) and confirms with Enter. |
| Filter | 500 particles. Predict with the IMU step plus noise, weight each particle by a rational kernel `1/(1+(e/σ)²)²` per anchor, then resample systematically. The kernel is heavy-tailed on purpose: it is robust to NLOS, and the explainer says so. *As built:* the kernel is asymmetric (σ = 1.5 m when the measured range is longer than predicted, 0.6 m when shorter), because NLOS only lengthens ranges. Across 365 puzzles the filter's mean error is about 1.0 m, worst 2.2 m. |
| Reveal | Draws the true path, the player's guesses and the filter's estimate. The particle cloud then replays all 8 turns collapsing onto the truth over about 3 s, or instantly under reduced motion. |
| Score | Mean error in metres, to 0.1 m. The badge goes to anyone who beats the filter on any turn. The "beat the filter on all 8" easter egg (spec §17) goes here. |

```
┌ lost-without-gps #42 ──────────────────────┐
│  you 3.8 m · filter 0.9 m                  │
│  beat the filter 2/8 ★                     │
│  [ map: truth ─, you ×, filter ◌ ]         │
│                                            │
│  [ >> we do this for real, without the     │
│       tapping. let's talk → ]              │  ← mailto, subject per game
│                                            │
│  how the filter did it (4 sentences)       │
│  read: peace through power · share · follow│
└────────────────────────────────────────────┘
```

### 3.3 `drift`

| | |
|---|---|
| Sim | A fixed 60 Hz tick. Inputs are `(tick, up/down)` pairs. The world is 100 units tall, and 10 units count as 1 m for the score. |
| Control | Hold, ↑ or tapping the top half climbs at a fixed rate. Releasing, ↓ or tapping the bottom half sinks at the same rate. It feels symmetric and is learnable in 3 seconds. |
| Corridor | The centre line is a bounded random walk. The width narrows from 62 to 26 units over 1,500 m. Speed ramps from 6 to 14 m/s. |
| Drift | The shown position is truth + bias. The bias is a random walk whose step size grows with distance, plus a slow constant component. The ghost's opacity is `max(0, 1 − |bias|/10)`. |
| Beacons | One every 90–160 m, in a 12-unit window. Passing through one sets the bias to 0. That gives a mint pulse, a tone if sound is on, and `navigator.vibrate(10)` where it exists. |
| End | The run ends when the true position touches a wall. Score is distance in whole metres. |
| Local scores | Personal best and top 5 with dates. A "the owner's best" line appears only if a value is set in the registry. |
| Challenge link | `drift.html?c=<seed in base36>.<metres>`. Opening it shows the same corridor under the banner `>> beat 1,284 m`, then the result `you won by 212 m` or `short by 88 m`, then their own link. |
| As built | Climb/sink at 50 units/s, easing in from 35% over the first 1.5 s. Drift pull 0.008 units/tick and a random walk, both × (1 + km/0.5); the ghost fades out at 16 units (1.6 m) of bias. Tuned with autopilots over 200 seeds: ignoring the ghost reaches a median of ~480 m, using it ~680 m, learning the drift rate and compensating ~1,800 m. A reachability check confirms courses are passable to 4 km. Touch is "hold anywhere to climb" rather than top/bottom halves, which is easier with one thumb. |

```
┌ drift ─────────────────────────────────────┐
│  1,284 m · best 1,530 m                    │
│  "I drifted 1,284 m before my IMU          │
│   betrayed me."                            │
│  [ >> challenge a friend → ]               │  ← Web Share or copy link
│                                            │
│  [ play again  ⏎ ]                         │
│  follow on x · play another · read the blog│
│  top 5: 1,530 · 1,284 · 990 · 812 · 600    │
└────────────────────────────────────────────┘
```

## 4. Proposed changes to the spec, from the audit

1. **HUD on play pages.** `site.js` mounts the site HUD on any `#hud` element. It also only adds the `../` prefix when `data-page="post"`, so on `/play/` its links would break.
   - Play pages use `data-page="play"` and a host with `id="playHud"`.
   - `shell.js` mounts that HUD itself, the way `home.js` does.
   - `site.js` is unchanged.
2. **HUD states.** `mountHud` breaks with a single state (`hud.js:45`), so:
   - the hub shows `home → i'm bored → markovle → lost → drift`;
   - a game page shows `home → i'm bored → <game>`.
3. **One loop per page.** `loop()` cannot be stopped, and each call leaves a `visibilitychange` listener behind. Every game page makes exactly one loop and idles it by returning false. Restarts reuse the same loop.
4. **Site HUD gets a fifth node.** One `play` entry goes into `pageStates()` in `hud.js`, so the HUD on About and Blog pages matches the nav.
5. **No `field.js` on the hub.** It needs scroll keyframes and covers the full viewport. The hub cards use each game's own preview renderer instead, which the spec already asks for.
6. **OG cards.** `tools/og/card.html` only knows posts. It gets a `?page=<slug>` branch, and `render.sh` gets a second loop over the four play pages.
7. **Nav in drafts.** "Every HTML file" includes 6 unlisted drafts, one of them named `post 2.html`. The nav item is added to all of them, because the drafts are reachable by URL.
8. **Determinism and noise.** The noise models in §3 stick to `+ − × ÷` and `Math.sqrt`, as spec §6 rule 4 requires. In `lost-without-gps` the filter's likelihood is a rational kernel, not a Gaussian. Headless tests in `tools/play/` run with `node --test` and need no `package.json`.
9. **Daily epoch.** Puzzle #1 is the launch date, set by a single constant `LAUNCH_UTC` in `daily.js`. It is set to the merge date before going live.

## 5. Open questions

1. **Label.** Is it `I'm Bored`, or `./play` if five items feel cramped?
2. **Contact.** Should the `lost-without-gps` CTA use the email already in the footer, with subject `Lost Without GPS — let's talk`? This is assumed below.
3. **Owner's `drift` best.** Do you want it shown? If so, send a score after playing.
4. **`feed.xml`.** Leaving it out of launch is assumed.
5. **Hub soft CTA.** It points to `about-more.html` until "Work so far" has content. Is that right?
6. **Launch date.** What is puzzle #1's UTC date?
7. **Backlog content.** Which of `spot-the-hallucination`, `tutor-turing-test` or `grade-it` would you write material for first?
