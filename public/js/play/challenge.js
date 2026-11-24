// Challenge links (spec §12): ?c=<seed in base36>.<score>. The score is a
// claim, not a verified result. Pure: safe to import in Node for tests.

export function encode(seed, score) {
  return (seed >>> 0).toString(36) + "." + Math.max(0, Math.floor(score));
}

export function decode(str) {
  const m = /^([0-9a-z]{1,7})\.(\d{1,7})$/.exec(String(str || "").toLowerCase());
  if (!m) return null;
  const seed = parseInt(m[1], 36);
  if (!(seed >= 0 && seed <= 0xffffffff)) return null;
  return { seed, score: parseInt(m[2], 10) };
}

export function fromLocation(loc = globalThis.location) {
  try {
    return decode(new URLSearchParams(loc.search).get("c"));
  } catch {
    return null;
  }
}
