# markovstate.sh — Motion Concept

| | |
|---|---|
| **Phase** | 2 of 7 (SPEC.md §17). Approved; the build is on this branch. |
| **Branch** | `feat/cinematic-motion` |
| **Written** | 2026-11-23 |
| **Status** | Approved 2026-11-23 with the recommended defaults: hero A with C's opening, no third-party JS, the arcs and multilingual line as proposed. Owner follow-ups: Kannada dropped (Hindi + English only), citations are 1000+, the Markov post's date is May 7. `task.png` is still open. See [README.md](README.md). |

This is the concept checkpoint. It refines the storyboard in SPEC.md §7, offers three hero directions, fixes the motion tokens and proposes the libraries. The owner approved it with the recommended defaults.

---

## 1. Audit findings

The repo matches SPEC.md §2. Five things the spec does not mention:

| Finding | Where | Proposed handling |
|---|---|---|
| Citation counts disagree: the home page says `1000+`, the About page says "over 700 citations". | `index.html`, `about-more.html` | Owner decides (question 3). |
| The pinned card dates *Be a Markov State* as May 7, 2025; `blogData.js` says May 20, 2025. | `about-more.html` | Owner decides (question 4). |
| Broken image: `../media/task.png` does not exist. | `posts/battle-tested-mental-models-for-relliable-llms.html` line 298 | Owner supplies the file or approves removing the figure (question 5). |
| Each post carries inline light-theme CSS that `post.css` overrides with `!important`. | every listed post | Leave as is. The generative header and progress chain are added around it. |
| Nav, footer, nav-toggle and reveal scripts are duplicated inline in every page. | all pages | Leave the markup. New shared behaviour goes in one module, `js/motion/site.js`. |

**Baseline Lighthouse scores and screenshots are not recorded yet.** The run was blocked by the session's permission settings. It needs to happen before any site file changes, so that the before/after comparison in the PR is honest (question 7).

---

## 2. The one idea

**One particle field, never cut.** A single full-viewport Canvas 2D layer sits behind the homepage and holds one set of particles (about 2,600 on desktop, 900 on mobile). Each state defines where those particles should be. Scrolling interpolates between one state's positions and the next.

So the globe does not fade out and a chip fade in: the globe's points *become* the chip. That is the Markov-chain idea made literal, and it is the site's signature moment. The same particles are, in turn:

| State | The particles form |
|---|---|
| s₀ boot | nothing; they are held inside the block cursor after `SANJAY THAKUR` |
| s₁ planet | the dotted globe |
| s₂ edge | a chip die and its traces, then a voice waveform |
| s₃ proof | a hairline baseline under the readouts |
| s₄ writing | one node per post, joining the chain |
| s_T terminal | a single lit node: the current state |

Everything that carries meaning (name, taglines, stats, post titles, links) is real HTML laid over the canvas. The canvas is `aria-hidden` decoration.

---

## 3. Storyboard

Each key frame below describes what is on screen if scrolling stops there.

### s₀ boot

- **Key frame:** black screen with hairline gridlines. Left: `>>hello, i'm` / `SANJAY THAKUR█` / the tagline. Right margin: the HUD, with `s₀` lit.
- **Motion:** follows the timing in SPEC.md §7.1. Two boot lines appear above the name and dim to grey as the name reveals. Total 1.6 s.
- **Rules:** the name is in the DOM at first paint and is the LCP element. Any key, click or scroll skips to the settled frame. `sessionStorage` makes repeat views instant. A visible "skip intro" button exists for the duration.
- **Copy:** `init perception… ok` / `loading state… ok` (from the spec). Lines appear whole; they are not typed character by character.

### s₁ planet

- **Key frame:** the globe fills the right 55% of the viewport, India facing the viewer. Three thin mint arcs end at Bengaluru. The location card reads `Bengaluru, India / home base / building the future, one device at a time.`
- **Motion:** particles leave the cursor block and settle onto the sphere in about 1.4 s. Arcs draw one after another. The globe then rotates slowly (as today) until scrolling starts.
- **Meaning:** origins and reach; building from India.
- **Blocked on:** the country list and arc endpoints (question 1).

### s₂ edge

A pinned scene, three viewport-heights long on desktop, in three beats:

1. **Dive.** The globe scales up around Bengaluru until the points pass the frame edge, and the same points regroup as a square chip die with traces fanning out. Caption: `edge ai — intelligence that runs on the device`.
2. **Voice.** Packets travel along the traces into a horizontal line that becomes a voice waveform. Under it, the same short sentence resolves in three scripts, one after another.
3. **Handwriting.** The waveform straightens into a ruled line. An SVG pen stroke writes a short answer, and a mint tick is drawn beside it. Caption: `widushi — voice-first, multilingual, evaluates handwritten answers`.

- **Key frames:** each beat holds for about a third of the pin, so stopping anywhere shows a finished composition.
- **Blocked on:** the sentence and its translations (question 6).

### s₃ proof

- **Key frame:** five readouts in a single row on a hairline baseline, set large: `uptime 14+ yrs`, `nodes 3 countries`, `startups 2`, `citations 1000+ ↗`, `curiosity ∞`. One quiet line beneath: `mila / mcgill · markovian ai (acquired 2023) · curium, singapore`.
- **Motion:** numbers scramble and settle once on entry (600 ms, 60 ms stagger). No other movement.
- **Layout shift:** each number sits in a fixed-width box sized for its final value.

### s₄ writing

- **Key frame:** the three most recent posts from `blogData.js` as rows. A vertical chain runs down the left edge with one node per row. `all posts →` closes the list.
- **Motion:** rows reveal with a 60 ms stagger. Hover or focus lights the row's node, draws its edge to the next node and shows the category.

### s_T terminal

- **Key frame:** centred, with generous space: `current state: open to conversations █`. Below it, four text links (github, linkedin, x, email), then two quieter links to *work so far* and *blog posts*. One lit node sits above the line; the HUD shows `s_T`.
- **Motion:** the remaining particles converge into the node. The cursor blinks. Nothing else moves.
- The existing footer bar stays below as the copyright line.

---

## 4. Hero directions (s₀ / s₁)

| | A. Globe | B. State graph | C. Single state |
|---|---|---|---|
| **Centrepiece** | Point-cloud globe on the right, text on the left. HUD in the margin. | The six-state graph, large and interactive. The globe is a thumbnail inside node s₁ and expands on scroll. | One mint block cursor after an oversized name. Scrolling releases the particles into the globe. |
| **First 5 seconds** | "Engineer, India, global." Readable at once. | "This site is a system." Distinctive, but abstract. | Very quiet and typographic. Nothing happens until you scroll. |
| **Risk** | Dotted globes are common on tech sites. | A visitor has to understand the metaphor to get anything from the hero, which SPEC.md §6.3 warns against. Weakest on mobile. | Can look empty to someone who does not scroll. |
| **Cost** | Lowest. The globe code and land mask already exist. | Highest. | Low. |

**Recommendation: A, opened with C's first beat.** The particles start inside the block cursor and fly out to assemble the globe on load, without waiting for a scroll. The visitor gets the legible globe hero within two seconds, and the assembly says that everything is built from the current state. The morph in §2 is what keeps the globe from looking generic.

The state graph stays as the HUD, as SPEC.md §3 decided.

---

## 5. Motion tokens

Added to `theme.css` and mirrored in `js/motion/tokens.js`. Values are those in SPEC.md §10.1, fixed to single numbers:

```css
--ease:        cubic-bezier(0.22, 1, 0.36, 1);  /* reveal (existing) */
--ease-ui:     cubic-bezier(0.2, 0, 0, 1);      /* hover, focus */
--dur-micro:   200ms;
--dur-ui:      360ms;
--dur-reveal:  700ms;
--dur-hero:    1600ms;
--stagger:     60ms;
--travel:      14px;
```

The existing `.reveal` class changes from an 18 px offset to `--travel` and becomes the only reveal mechanism. Scroll-scrubbed scenes map progress linearly, with no smoothing.

---

## 6. Libraries

Measured from npm on 2026-11-23, minified and gzipped:

| Library | Version | Size | Licence | Proposal |
|---|---|---|---|---|
| GSAP core | 3.15.1 | 27.8 KB | GSAP standard "no charge" licence | **Do not use** |
| ScrollTrigger | 3.15.1 | 17.6 KB | same | **Do not use** |
| Lenis | 1.3.27 | 5.3 KB | MIT | **Do not use** |
| Three.js (full module) | 0.187.0 | 185.0 KB | MIT | **Do not use** |
| IBM Plex Mono, latin, 4 weights | woff2 | 58.6 KB total (not JS) | SIL OFL | **Vendor** into `public/vendor/fonts/` |

**Proposal: no third-party JavaScript.** This departs from SPEC.md §11, which names GSAP as preferred for pinned scenes, so it needs the owner's agreement (question 2). The reasons:

- **Budget.** GSAP with ScrollTrigger is 45 KB, which alone exceeds the 30 KB aim for all motion code.
- **Pinning** is done with CSS `position: sticky`. The browser keeps native scroll momentum and there is no scroll-jacking to tune.
- **Scrubbing** needs one helper: read a section's scroll progress once per frame and hand it to the scene. That is about 1 KB.
- **3D.** A 2,600-point globe and a flat chip are well within Canvas 2D. The current globe already does this. With no WebGL there is no context to manage and no WebGL fallback to build.
- **Smooth scroll.** Lenis changes native scroll feel for no gain here.

Estimated motion code: 18–24 KB gzipped for the home page, under 8 KB for a post page.

If the s₂ dive does not look good enough in 2D once prototyped, the fallback is to lazy-load Three.js for that scene only. That decision would come back to the owner.

### File layout

```
public/
  vendor/fonts/          IBM Plex Mono woff2 + OFL licence
  js/motion/
    tokens.js            durations, easings, seeded random, scroll-progress helper
    site.js              nav toggle, reveals, view transitions, cursor-tracked borders
    hud.js               state-graph HUD
    field.js             the shared particle field
    post-header.js       generative post headers + reading-progress chain
    scenes/boot.js  planet.js  edge.js  proof.js  writing.js  terminal.js
```

---

## 7. Mobile and reduced motion, per scene

On mobile nothing is pinned for more than one viewport-height, and scenes play once on entry instead of scrubbing.

| Scene | Mobile (≤ 820 px) | `prefers-reduced-motion` |
|---|---|---|
| **HUD** | A thin horizontal chain under the nav: six nodes, the current one lit. Each node is a 44 px touch target. No labels or probabilities. | Settled graph, current node lit. No pulses. |
| **s₀** | Same sequence, 1.2 s. Gridlines reduced to the frame border. | No boot lines. Final frame at first paint. |
| **s₁** | Globe below the text at 320 px, 900 points. Location card sits under it. | Static assembled globe with all arcs drawn. |
| **s₂** | Three stacked panels, each playing its beat once when 50% visible. No pin. | Three static panels: the die, the waveform with all three scripts, the finished stroke with its tick. |
| **s₃** | Two-column grid of readouts. | Final numbers; no count-up. |
| **s₄** | Rows show title and date; the category moves under the title. The node lights on tap-down. | Rows visible; no stagger. |
| **s_T** | Links stacked at 44 px height each. | Static node and line; the cursor does not blink. |
| **Post header** | 120 px tall instead of 200 px. | The final still frame only. |
| **Page transitions** | Cross-fade, 200 ms. | Instant. |

With motion off, every state is still a composed frame: gridlines, the HUD, the still particle arrangement and the type.

---

## 8. Decisions needed from the owner

1. **Countries and arcs.** Is the list India, Canada, Singapore? Which points should the arcs touch? The site itself supports Toronto (Markovian AI), Montreal (Mila / McGill), Singapore (Curium) and Bengaluru. Proposed arcs: India → Montreal, Montreal → Singapore, Singapore → Bengaluru.
2. **Libraries.** Approve "no third-party JavaScript" (§6), or keep GSAP as the spec prefers?
3. **Citations.** Is `1000+` current? If so, may the About page sentence "over 700 citations" be updated to match? It is your own writing, so it will not be touched without a yes.
4. **Pinned-card date.** May 7 or May 20, 2025 for *Be a Markov State*?
5. **`media/task.png`.** Do you have the file, or should the empty figure be removed from the post?
6. **The s₂ sentence.** Beat 2 needs one short sentence shown in Devanagari, Kannada and Latin script. It must be something Widushi would plausibly hear from a child, and you should supply or proofread the Hindi and Kannada. Suggested English: "why is the sky blue?" Also confirm that Kannada is right to show.
7. **Baseline.** Allow the Lighthouse run in the next session, or run it yourself (`npx lighthouse http://localhost:3000 --output=json` against `npx serve public`, for the home page and one post) and commit the JSON to `docs/motion/baseline/`.

And the main one: **hero direction A + C's opening, as recommended in §4?**

---

## 9. Build order after approval

1. Vendor the fonts, add the tokens, correct the two content items from SPEC.md §4 (`3 countries`, `Bengaluru`).
2. Prototype the three riskiest pieces on the home page: the particle field with the s₁ → s₂ morph, the HUD, and the boot sequence. Take them through mobile and reduced motion before going wider.
3. Remaining home scenes (s₃, s₄, s_T).
4. Site-wide: HUD and page transitions on every page, post headers, reading progress, lazy video with posters, Open Graph and canonical tags.
5. QA, polish pass, PR. Nothing goes to `main` without approval.
