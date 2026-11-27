import { useEffect, useState } from "react";

/** A value kept in this browser; storage may be blocked (private window), then it lasts until the tab closes. */
export function useStored<T>(key: string, initial: T, parse: (raw: string) => T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : parse(raw);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch {
      // storage blocked
    }
  }, [key, value]);
  return [value, setValue];
}
