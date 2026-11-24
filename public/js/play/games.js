// The single list of games (spec §13). The hub, "play another", "surprise me"
// and the HUD all read from it. Hrefs are relative to /play/.
// Adding a game: one entry here, one play/<slug>.html, one <slug>/sim.js + view.js.

const MAIL = "mailto:sttsanjay@gmail.com";
export const X_URL = "https://x.com/WanabeMarkovian";
export const GITHUB_URL = "https://github.com/sanjaythakur";

export const GAMES = [
  // Quick ones: nothing to know, just play.
  {
    slug: "how-many",
    title: "how many?",
    hook: "A cloud of dots flashes for a second. Guess how many.",
    rule: "don't count, guess. 5 clouds a day, closest wins.",
    type: "daily",
    time: "~60 s",
    status: "live",
    daily: true,
    casual: true,
    hud: "count",
    cta: { kind: "share", copy: ">> share today's result" },
    post: { title: "the blog", href: "../blog.html" },
  },
  {
    slug: "echo",
    title: "echo",
    hook: "Watch the dot hop. Tap the same path back.",
    rule: "watch the dot hop between shapes, then tap the same path. one more hop each level.",
    type: "arcade",
    time: "30–120 s",
    status: "live",
    daily: false,
    casual: true,
    hud: "echo",
    unit: "hops",
    cta: { kind: "share", copy: ">> challenge a friend" },
    post: { title: "Be a Markov State", href: "../posts/be-a-markov-state.html" },
  },
  {
    slug: "reflex",
    title: "reflex",
    hook: "Wait for green. Tap. How fast are you, really?",
    rule: "tap the moment the box turns green. 5 rounds, average wins.",
    type: "arcade",
    time: "~30 s",
    status: "live",
    daily: false,
    casual: true,
    hud: "tap",
    unit: "ms",
    lower: true,
    cta: { kind: "share", copy: ">> challenge a friend" },
    post: { title: "the blog", href: "../blog.html" },
  },
  // Nerdy ones: about the things I work on.
  {
    slug: "markovle",
    title: "markovle",
    hook: "Watch a trajectory. Guess which Markov chain made it.",
    rule: "watch the particle hop, then pick the chain that made it. 5 rounds a day.",
    type: "daily",
    time: "~90 s",
    status: "live",
    daily: true,
    hud: "guess",
    cta: {
      kind: "read",
      copy: ">> the chain doesn't remember. should you? read the post",
      href: "../posts/be-a-markov-state.html",
    },
    post: { title: "Be a Markov State", href: "../posts/be-a-markov-state.html" },
  },
  {
    slug: "lost-without-gps",
    title: "lost without gps",
    hook: "GPS is jammed. Find the vehicle from noisy ranges.",
    rule: "tap where you think the vehicle is. 8 turns. lower error wins.",
    type: "daily",
    time: "~120 s",
    status: "live",
    daily: true,
    hud: "lost",
    cta: {
      kind: "contact",
      copy: ">> we do this for real, without the tapping. building something that can't trust GPS? let's talk",
      href: MAIL + "?subject=" + encodeURIComponent("Lost Without GPS — let's talk"),
    },
    post: { title: "Peace Through Power", href: "../posts/peace-through-strength.html" },
  },
  {
    slug: "drift",
    title: "drift",
    hook: "One thumb. Your position estimate is lying to you.",
    rule: "hold to climb, release to sink. fly through beacons to fix your estimate.",
    type: "arcade",
    time: "30–90 s",
    status: "live",
    daily: false,
    hud: "drift",
    unit: "m",
    ownerBest: null, // set to the owner's best run (metres) to show it as a target
    cta: { kind: "share", copy: ">> challenge a friend" },
    post: { title: "the blog", href: "../blog.html" },
  },
];

export const live = () => GAMES.filter((g) => g.status === "live");
export const bySlug = (slug) => GAMES.find((g) => g.slug === slug);
