// s₀ — boot. The sequence itself is CSS (theme + index.html) so it never
// waits on JS; this module only makes it skippable and cleans up.
// html.boot is set by the inline head script on the first visit per session.

export function initBoot({ skipButton, onSkip }) {
  const html = document.documentElement;
  if (!html.classList.contains("boot")) return false;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    html.classList.add("boot-skip");
    onSkip && onSkip();
    cleanup();
    // Next frame: drop the boot classes; elements are already in their end state.
    requestAnimationFrame(() => html.classList.remove("boot", "boot-skip"));
  };
  const events = ["keydown", "pointerdown", "wheel", "touchstart"];
  const cleanup = () => events.forEach((e) => window.removeEventListener(e, finish));
  events.forEach((e) => window.addEventListener(e, finish, { passive: true, once: true }));
  skipButton && skipButton.addEventListener("click", finish);

  // Natural end of the 1.8 s sequence.
  setTimeout(() => {
    if (done) return;
    done = true;
    cleanup();
    html.classList.remove("boot");
  }, 1900);
  return true;
}
