// Share text via the Web Share API where it exists, the clipboard otherwise
// (spec §12). The text carries the result and the URL, nothing about the visitor.
// Resolves to "shared", "copied", "cancelled" or "failed".

export async function share(text) {
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    ta.remove();
    return ok ? "copied" : "failed";
  }
}

export const shareLabel = {
  shared: "shared",
  copied: "copied to clipboard",
  cancelled: "",
  failed: "couldn't copy; select the text above",
};
