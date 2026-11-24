# Motion system — maintainer notes

This is how the motion system on markovstate.sh works and how to change it. The design rationale is in [CONCEPT.md](CONCEPT.md) and the brief is in `SPEC.md`.

The site uses plain HTML, CSS and ES modules. There is no build step and nothing loads from a CDN at runtime. Fonts are in `public/vendor/fonts/` and there is no third-party JS.

## File map

| File | What it does |
|---|---|
| `public/theme.css` | Self-hosted fonts and motion tokens. Also: reveals, gridlines, border glow, the HUD, the boot sequence, view transitions, the reading chain and reduced-motion overrides. |
| `public/js/motion/tokens.js` | The JS twin of the CSS tokens (durations, stagger, colours). Also maths helpers, the seeded RNG, `fitCanvas` and `loop()`, the render loop that sleeps when idle. |
| `public/js/motion/site.js` | Loaded on every page. Runs the reveal observer and border glow, and mounts the page-level HUD. |
| `public/js/motion/hud.js` | The state-graph HUD: an SVG of real `<a>` nodes that pulses between states. |
| `public/js/motion/field.js` | The shared particle field on the home page. Particles morph between keyframes anchored to scroll positions. |
| `public/js/motion/home.js` | Home page wiring. Holds the HUD states, the boot sequence and the list of field keyframes. |
| `public/js/motion/scenes/*.js` | One file per home scene: `planet` (globe and journey), `edge` (chip → wave → handwriting), `proof`, `writing`, `terminal` and `boot`. `landmask` holds the globe's land data. |
| `public/js/motion/post-header.js` | Generates the header for each post. The same image is a still on the blog index. |
| `public/js/motion/post.js` | Post pages: the header, the reading-progress chain, lazy video posters and visibility-gated autoplay. |
| `public/js/motion/blog.js` | Blog index: card previews and the first-load stagger. |
| `tools/og/` | Build-time only. `card.html` and `render.sh` produce the per-post OG images in `public/media/og/`. |
| `public/media/opt/` | WebP and MP4 derivatives plus video posters. The originals in `public/media/` are not changed. |

## Adding a post

1. Write the post HTML as before and add its entry to `public/blogData.js`. That file is still the only source of post data.
2. Copy the `<head>` block and the two scripts before `</body>` from an existing listed post, for example `posts/be-a-markov-state.html`. Add `data-page="post"` to `<body>`, then add the `<nav class="hud hud--desktop">` and `<canvas class="post-header">` lines.
3. The header is generated automatically. It is seeded from the file name (slug), and the `category` in blogData picks its family:
   - `ai` → graph
   - `defence` → radar
   - `education` → wave
   - anything else → chain

   Renaming the file changes the header.
4. For media, put an optimised copy in `media/opt/` and keep the original. For autoplay clips, use `preload="none" data-autoplay data-poster="…"` and do not use `autoplay`; the script plays a clip only while it is on screen.
5. **Open Graph image.** Copy the `og:image`, `og:image:width`, `og:image:height` and `twitter:card` tags from an existing post and change the slug. Then run `sh tools/og/render.sh` from the repo root and commit the new `public/media/og/<slug>.png`. The script serves the repo locally and screenshots `tools/og/card.html` in headless Chrome at 1200×630, once per post in `blogData.js`. The card's art comes from the same `drawHeader` call as the post header, so the image always matches it. `tools/` is never deployed.

## Tuning motion

- **Tokens:** they live in two places that must agree:
  - the `--dur-*`, `--stagger`, `--travel` and `--ease-ui` variables in `theme.css`;
  - `DUR`, `STAGGER` and `TRAVEL` in `tokens.js`.

  Change both together.
- **Particle count:** `makeGlobe(step)` in `home.js`. A larger step means fewer particles. Low-power devices already get `3.4` instead of `2.35`.
- **Boot sequence:** runs once per browser session (sessionStorage `ms.booted`). To see it again, open a new tab or clear the key. Any key, click, scroll or the "skip intro" button skips it.

## Switching a scene off

On the home page, remove the scene from the `keyframes: [...]` array in `home.js`, along with its section in `index.html` if you want the content gone too. The field morphs between the remaining neighbours.

To turn off motion entirely, set reduced motion in the OS. Every scene has a static version, and the content is fully readable without JS.

## Things that must not regress

- **Overflow:** `html, body { overflow-x: clip }` must stay `clip`. With `hidden`, the sticky s₂ section and the post sidebars stop working.
- **Reveal class:** the `.reveal` start state is gated on `html.js`. The inline head script only adds that class when modules are supported, and a 4 s timeout removes it if `site.js` never runs.
- **Animation properties:** animate only `transform` and `opacity`. The canvas draws all the motion that would otherwise need layout.

## Before / after (Lighthouse mobile, local server, 2026-11-23)

| Page | Before (P / A11y / BP / SEO) | After | LCP after | CLS after |
|---|---|---|---|---|
| Home | 94 / 100 / 96 / 100 | 100 / 100 / 100 / 100 | 1.5 s (was 2.5 s) | 0 |
| be-a-markov-state | 99 / 98 / 96 / 90 | 99 / 98 / 100 / 100 | 1.8 s | 0 |
| Handwriting post | 98 / 93 / 96 / 90 | 96 / 98 / 100 / 100 | 1.7 s | 0 |
| Blog | CLS 0.095 | 99 / 98 / 100 / 100 | — | 0 |

The home page scores 100 on all four categories on desktop. Its JS weighs about 21.5 KB gzipped, posts about 10.8 KB and the blog about 9.6 KB.
