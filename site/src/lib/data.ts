/**
 * Data access. JSON comes straight from the `data` branch via raw.githubusercontent.com
 * (CORS-enabled, cached ~5 min). Override with VITE_DATA_BASE, e.g. to point at a local collector run.
 */
import { useEffect, useState } from "react";
import type { BuyList } from "../../../src/shared/signals.ts";
import type { DailySeries, HourlySeries, Meta } from "../../../src/shared/types.ts";

export const DATA_BASE: string =
  import.meta.env.VITE_DATA_BASE ?? "https://raw.githubusercontent.com/FrancoisCordier/forever-broke/data/data";

/** The owner's house (config.yaml focusHouse). */
export const HOUSE = 110;

const cache = new Map<string, Promise<unknown>>();

export function fetchJson<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(`${DATA_BASE}/${path}`).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path)); // allow a retry after a failure
    cache.set(path, p);
  }
  return p as Promise<T>;
}

export type Loadable<T> = { state: "loading" } | { state: "error"; error: string } | { state: "ok"; data: T };

export function useJson<T>(path: string | null): Loadable<T> {
  const [value, setValue] = useState<Loadable<T>>({ state: "loading" });
  useEffect(() => {
    if (!path) return;
    let live = true;
    setValue({ state: "loading" });
    fetchJson<T>(path).then(
      (data) => live && setValue({ state: "ok", data }),
      (e: unknown) => live && setValue({ state: "error", error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      live = false;
    };
  }, [path]);
  return value;
}

export const useBuyList = () => useJson<BuyList>(`${HOUSE}/buylist.json`);
export const useMeta = () => useJson<Meta>("meta.json");
export const useHourly = (id: number) => useJson<HourlySeries>(`${HOUSE}/hourly/${id}.json`);
export const useDaily = (id: number) => useJson<DailySeries>(`${HOUSE}/daily/${id}.json`);
