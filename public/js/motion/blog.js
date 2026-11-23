// Blog index: editorial list rendered by the page's own script from
// blogData.js. This module adds the generative previews (the same seeded
// drawer as the post headers, as a still) and the one-time row stagger.

import { staggerIn } from "./site.js";
import { drawHeader, slugOf } from "./post-header.js";
import { fitCanvas } from "./tokens.js";

const list = document.getElementById("posts-list");

function drawPreviews() {
  list.querySelectorAll("canvas.post-card__preview").forEach((c) => {
    const { ctx, w, h } = fitCanvas(c);
    drawHeader(ctx, w, h, { slug: slugOf(c.dataset.file), category: c.dataset.category, t: 1, labels: false });
  });
}

if (list) {
  let first = true;
  new MutationObserver(() => {
    if (!list.querySelector(".post-card")) return;
    drawPreviews();
    // Rows reveal once with a tight stagger, then stay settled: filtering
    // and paging re-render instantly.
    if (first) {
      first = false;
      staggerIn(list.querySelectorAll(".post-card"));
    }
  }).observe(list, { childList: true });

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(drawPreviews, 150);
  });
}
