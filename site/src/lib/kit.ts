/** Raid kits (config.yaml `kits`): the viewer's choices, rows per slot, and "is it a good time to buy". */
import { useEffect, useState } from "react";
import { type BuyListItem, buyable, costOfUnits, type Kit } from "../../../src/shared/signals.ts";
import { formatPct } from "./format.ts";

const KIT_KEY = "forever-broke.kit";

/** Per-viewer choices, kept in localStorage: which kit, how many nights, and per-slot overrides. */
export interface KitPrefs {
  kit: string;
  nights: number;
  /** "kitId:slot name" → chosen item id. Keyed by name so reordering slots in config.yaml keeps choices. */
  choice: Record<string, number>;
  /** "kitId:slot name" → units per night. */
  perNight: Record<string, number>;
}

const DEFAULT_PREFS: KitPrefs = { kit: "", nights: 4, choice: {}, perNight: {} };

export function useKitPrefs(): [KitPrefs, (p: KitPrefs) => void] {
  const [prefs, setPrefs] = useState<KitPrefs>(() => {
    try {
      return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KIT_KEY) ?? "{}") };
    } catch {
      return DEFAULT_PREFS;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KIT_KEY, JSON.stringify(prefs));
    } catch {
      // storage blocked: choices just don't persist
    }
  }, [prefs]);
  return [prefs, setPrefs];
}

export const pickKit = (kits: Kit[], prefs: KitPrefs): Kit | undefined =>
  kits.find((k) => k.id === prefs.kit) ?? kits[0];

export interface KitRow {
  key: string;
  slot: string;
  note?: string;
  dps?: number;
  options: BuyListItem[];
  item: BuyListItem | undefined;
  perNight: number;
  need: number;
  /** Cost of the `units` cheapest listed units (≤ need). */
  cost: number;
  units: number;
}

export function kitRows(kit: Kit, items: BuyListItem[], prefs: KitPrefs): KitRow[] {
  const byId = new Map(items.map((x) => [x.id, x]));
  return kit.slots.map((s) => {
    const key = `${kit.id}:${s.slot}`;
    const options = s.options.map((id) => byId.get(id)).filter((x): x is BuyListItem => x !== undefined);
    const chosen = prefs.choice[key];
    const item = options.find((x) => x.id === chosen) ?? options[0];
    const perNight = prefs.perNight[key] ?? s.perNight;
    const need = perNight * prefs.nights;
    const { units, cost } = item && item.now !== null ? costOfUnits(item.ladder, need) : { units: 0, cost: 0 };
    return { key, slot: s.slot, note: s.note, dps: s.dps, options, item, perNight, need, cost, units };
  });
}

/** How far under what buyers paid counts as a good buy for your own use, and the evidence needed. */
const UNDER_PAID_PCT = 10;
const MIN_SALES_HOURS = 12;

export interface GoodBuy {
  /** Why now, e.g. "−24% vs normal". */
  reasons: string[];
  /** Highest unit price that still meets at least one reason. */
  upTo: number;
  /** Units listed at ≤ upTo. */
  units: number;
}

/**
 * Is now a good time to buy this for your own raids? Any of: cheap vs its normal price (ADR-0007), under the cost
 * of its reagents (ADR-0010), or listed under what buyers have actually been paying (ADR-0012).
 */
export function goodBuy(x: BuyListItem, belowCraftPct: number): GoodBuy | null {
  if (x.now === null) return null;
  const reasons: string[] = [];
  let upTo = 0;
  if (x.cheap && x.upTo !== null) {
    reasons.push(`${formatPct(x.change)} vs normal`);
    upTo = Math.max(upTo, x.upTo);
  }
  if (x.belowCraft && x.craftCost) {
    reasons.push(`${formatPct(x.craftChange)} vs reagents`);
    upTo = Math.max(upTo, Math.floor(x.craftCost * (1 - belowCraftPct / 100)));
  }
  const paid = x.sales?.avgPrice;
  if (paid && (x.sales?.hours ?? 0) >= MIN_SALES_HOURS && x.now <= paid * (1 - UNDER_PAID_PCT / 100)) {
    reasons.push(`${formatPct(x.now / paid - 1)} vs what buyers paid`);
    upTo = Math.max(upTo, Math.floor(paid * (1 - UNDER_PAID_PCT / 100)));
  }
  if (reasons.length === 0) return null;
  return { reasons, upTo, units: buyable(x.ladder, upTo).units };
}
