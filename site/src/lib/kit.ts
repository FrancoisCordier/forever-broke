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

/**
 * Kits as written before ADR-0014 have only a label ("Hunter · Marksmanship"): split it into class and spec
 * so the picker works until the collector's next run rewrites the buy list.
 */
export const withClass = (kits: Kit[]): Kit[] =>
  kits.map((k) => {
    if (k.class && k.spec) return k;
    const [cls, ...spec] = k.label.split(" · ");
    return { ...k, class: cls, spec: spec.join(" · ") || cls };
  });

/** Classes in the order their first kit appears, each with its kits (specs). */
export function kitsByClass(kits: Kit[]): [string, Kit[]][] {
  const by = new Map<string, Kit[]>();
  for (const k of kits) by.set(k.class, [...(by.get(k.class) ?? []), k]);
  return [...by.entries()];
}

export interface KitRow {
  key: string;
  slot: string;
  note?: string;
  dps?: number;
  options: BuyListItem[];
  item: BuyListItem | undefined;
  /** The chosen item binds when picked up: farm or quest it, the AH never has it. */
  soulbound: boolean;
  perNight: number;
  need: number;
  /** Cost of the `units` cheapest listed units (≤ need). Zero when soulbound. */
  cost: number;
  units: number;
}

/**
 * The option a slot starts on: the cheapest listed one when the slot says its options are interchangeable,
 * otherwise the first one the AH can have (soulbound items come last), otherwise the first.
 */
export function defaultOption(
  options: BuyListItem[],
  soulbound: ReadonlySet<number>,
  cheapest = false,
): BuyListItem | undefined {
  const tradeable = options.filter((x) => !soulbound.has(x.id));
  if (cheapest) {
    const priced = tradeable.filter((x) => x.now !== null);
    if (priced.length) return priced.reduce((a, b) => ((b.now as number) < (a.now as number) ? b : a));
  }
  return tradeable[0] ?? options[0];
}

export function kitRows(
  kit: Kit,
  items: BuyListItem[],
  prefs: KitPrefs,
  soulbound: ReadonlySet<number> = new Set(),
): KitRow[] {
  const byId = new Map(items.map((x) => [x.id, x]));
  return kit.slots.map((s) => {
    const key = `${kit.id}:${s.slot}`;
    const options = s.options.map((id) => byId.get(id)).filter((x): x is BuyListItem => x !== undefined);
    const chosen = prefs.choice[key];
    const item = options.find((x) => x.id === chosen) ?? defaultOption(options, soulbound, s.cheapest);
    const bound = item !== undefined && soulbound.has(item.id);
    const perNight = prefs.perNight[key] ?? s.perNight;
    const need = perNight * prefs.nights;
    const { units, cost } =
      item && !bound && item.now !== null ? costOfUnits(item.ladder, need) : { units: 0, cost: 0 };
    return {
      key,
      slot: s.slot,
      note: s.note,
      dps: s.dps,
      options,
      item,
      soulbound: bound,
      perNight,
      need,
      cost,
      units,
    };
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
  /** The biggest of the discounts, e.g. −0.24. */
  discount: number;
  /** The price that discount is measured against (normal, reagent cost or average paid). */
  ref: number;
}

/**
 * Is now a good time to buy this for your own raids? Any of: cheap vs its normal price (ADR-0007), under the cost
 * of its reagents (ADR-0010), or listed under what buyers have actually been paying (ADR-0012).
 */
export function goodBuy(x: BuyListItem, belowCraftPct: number): GoodBuy | null {
  if (x.now === null) return null;
  const now = x.now;
  const reasons: string[] = [];
  let upTo = 0;
  let discount = 0;
  let ref = now;
  const reason = (vs: number, text: string, limit: number) => {
    const d = now / vs - 1;
    reasons.push(`${formatPct(d)} ${text}`);
    upTo = Math.max(upTo, limit);
    if (d < discount) {
      discount = d;
      ref = vs;
    }
  };
  if (x.cheap && x.upTo !== null && x.normal) reason(x.normal, "vs normal", x.upTo);
  if (x.belowCraft && x.craftCost)
    reason(x.craftCost, "vs reagents", Math.floor(x.craftCost * (1 - belowCraftPct / 100)));
  const paid = x.sales?.avgPrice;
  if (paid && (x.sales?.hours ?? 0) >= MIN_SALES_HOURS && now <= paid * (1 - UNDER_PAID_PCT / 100))
    reason(paid, "vs what buyers paid", Math.floor(paid * (1 - UNDER_PAID_PCT / 100)));
  if (reasons.length === 0) return null;
  return { reasons, upTo, units: buyable(x.ladder, upTo).units, discount, ref };
}
