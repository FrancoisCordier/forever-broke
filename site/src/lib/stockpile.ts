/**
 * Stockpile lots, kept in this browser's localStorage (ADR-0011). Backup = the JSON copied to the clipboard,
 * restore = pasting it back, which is how lots move between devices.
 */
import { useEffect, useMemo, useState } from "react";
import type { BuyListItem } from "../../../src/shared/signals.ts";
import { type Lot, type Market, normalFromDaily, type Purpose } from "../../../src/shared/stockpile.ts";
import type { DailySeries, Latest } from "../../../src/shared/types.ts";
import { fetchJson, HOUSE } from "./data.ts";

const KEY = "forever-broke.stockpile";
const PURPOSES: Purpose[] = ["resell", "own", "alt"];

export const PURPOSE_LABEL: Record<Purpose, string> = {
  resell: "To resell",
  own: "For my raids",
  alt: "Alt's levelling mats",
};

/** Validate lots read from storage or pasted from a backup. Drops anything malformed; null if it isn't lots at all. */
export function parseLots(json: string): Lot[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const list = (raw as { lots?: unknown })?.lots ?? raw;
  if (!Array.isArray(list)) return null;
  return list.filter(
    (l): l is Lot =>
      typeof l?.id === "string" &&
      Number.isInteger(l.item) &&
      Number.isInteger(l.qty) &&
      l.qty >= 0 &&
      Number.isInteger(l.unitCost) &&
      l.unitCost >= 0 &&
      PURPOSES.includes(l.purpose) &&
      typeof l.added === "string",
  );
}

export const backupOf = (lots: Lot[]) => JSON.stringify({ version: 1, lots });

export function useLots(): [Lot[], (lots: Lot[]) => void] {
  const [lots, setLots] = useState<Lot[]>(() => {
    try {
      return parseLots(localStorage.getItem(KEY) ?? "[]") ?? [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, backupOf(lots));
    } catch {
      // storage blocked (private window): lots last until the tab closes
    }
  }, [lots]);
  return [lots, setLots];
}

export const newLotId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/**
 * Market data for each item in `ids`: watchlist items from the buy list (hourly normal), others from
 * latest.json and their daily file (daily normal).
 */
export function useMarkets(ids: number[], buyList: BuyListItem[], latest: Latest | null): Map<number, Market> {
  const watched = useMemo(() => new Map(buyList.map((x) => [x.id, x])), [buyList]);
  const others = ids.filter((id) => !watched.has(id));
  const otherKey = [...new Set(others)].sort((a, b) => a - b).join(",");
  const [dailyNormal, setDailyNormal] = useState<Record<number, number | null>>({});

  useEffect(() => {
    if (!otherKey) return;
    let live = true;
    const todo = otherKey.split(",").map(Number);
    Promise.all(
      todo.map((id) =>
        fetchJson<DailySeries>(`${HOUSE}/daily/${id}.json`).then(
          (d) => [id, normalFromDaily(d)] as const,
          () => [id, null] as const,
        ),
      ),
    ).then((pairs) => live && setDailyNormal((prev) => ({ ...prev, ...Object.fromEntries(pairs) })));
    return () => {
      live = false;
    };
  }, [otherKey]);

  return useMemo(() => {
    const out = new Map<number, Market>();
    for (const id of ids) {
      const w = watched.get(id);
      if (w) {
        out.set(id, { now: w.now, min: w.min, normal: w.normal, qty: w.qty });
        continue;
      }
      const row = latest?.items[id];
      out.set(id, {
        now: row ? row[1] : null,
        min: row ? row[0] : null,
        normal: dailyNormal[id] ?? null,
        qty: row ? row[3] : 0,
      });
    }
    return out;
  }, [ids, watched, latest, dailyNormal]);
}
