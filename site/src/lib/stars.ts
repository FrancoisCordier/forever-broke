/** Starred items (ADR-0014): one set shared by every list on the page, kept in this browser. */
import { useSyncExternalStore } from "react";

const KEY = "forever-broke.stars";

function read(): ReadonlySet<number> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return new Set(Array.isArray(saved) ? saved.filter((x): x is number => Number.isInteger(x)) : []);
  } catch {
    return new Set();
  }
}

let stars = read();
const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab starred something: pick it up here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    stars = read();
    notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function toggleStar(id: number) {
  const next = new Set(stars);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  stars = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // storage blocked: stars last until the tab closes
  }
  notify();
}

export const useStars = (): ReadonlySet<number> => useSyncExternalStore(subscribe, () => stars);
