// Namespaced localStorage wrapper (spec §12). Every read and write is wrapped,
// so private browsing, disabled storage or a full quota never break a game:
// values simply fall back to their defaults and writes are dropped.

const NS = "markovstate:play:";

export function store(slug) {
  const key = (k) => NS + slug + ":" + k;
  return {
    get(k, fallback = null) {
      try {
        const raw = localStorage.getItem(key(k));
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(k, value) {
      try {
        localStorage.setItem(key(k), JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}

// Settings shared by every game (sound toggle).
export const settings = store("_");
