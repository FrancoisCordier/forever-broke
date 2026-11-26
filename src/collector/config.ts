import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { Kit, KitSlot } from "../shared/signals.ts";

export interface HouseConfig {
  id: number;
  label: string;
  faction: string;
  set: string;
}

export interface Thresholds {
  belowMedianPct: number;
  minUnitsListed: number;
  minNormalDays: number;
  belowCraftPct: number;
  sellAboveCostPct: number;
  sellAboveNormalPct: number;
  flipMarginPct: number;
  flipHoldDays: number;
  flipMinSalesHours: number;
  flipMinProfitGold: number;
}

/** config.yaml `kits`: kit id → label and slots. Converted to `Kit[]` for the buy list. */
export type KitsConfig = Record<string, { label: string; slots: KitSlot[] }>;

export interface Config {
  region: string;
  /** The owner's house: the only one the buy list is computed for. */
  focusHouse: number;
  /** ISO date-time the raids open (shown as a countdown and on charts). */
  raidOpens: string;
  houses: HouseConfig[];
  /** group → item id → name (name is a human label only; the id is what counts). */
  watchlist: Record<string, Record<string, string>>;
  /** item id → vendor price in copper, for items an NPC sells (no point stockpiling above it). */
  vendorPrices: Record<string, number>;
  thresholds: Thresholds;
  kits: KitsConfig;
}

const DEFAULT_THRESHOLDS: Thresholds = {
  belowMedianPct: 20,
  minUnitsListed: 20,
  minNormalDays: 1,
  belowCraftPct: 10,
  sellAboveCostPct: 30,
  sellAboveNormalPct: 15,
  flipMarginPct: 15,
  flipHoldDays: 2,
  flipMinSalesHours: 12,
  flipMinProfitGold: 5,
};

export async function loadConfig(path = "config.yaml"): Promise<Config> {
  const cfg = parse(await readFile(path, "utf8")) as Config;
  if (!cfg?.region || !Array.isArray(cfg.houses) || cfg.houses.length === 0) {
    throw new Error(`${path}: region and at least one house are required`);
  }
  for (const h of cfg.houses)
    if (!Number.isInteger(h.id)) throw new Error(`${path}: bad house id ${JSON.stringify(h)}`);
  if (!cfg.houses.some((h) => h.id === cfg.focusHouse)) {
    throw new Error(`${path}: focusHouse ${cfg.focusHouse} must be one of the configured houses`);
  }
  if (Number.isNaN(Date.parse(cfg.raidOpens))) throw new Error(`${path}: raidOpens must be an ISO date`);
  cfg.watchlist ??= {};
  cfg.vendorPrices ??= {};
  cfg.thresholds = { ...DEFAULT_THRESHOLDS, ...cfg.thresholds };
  cfg.kits ??= {};
  checkKits(cfg, path);
  return cfg;
}

/** Every kit item must be on the watchlist: that's the only place its price comes from. */
function checkKits(cfg: Config, path: string): void {
  const watch = watchlistIds(cfg);
  for (const [id, kit] of Object.entries(cfg.kits)) {
    if (!kit?.label || !Array.isArray(kit.slots)) throw new Error(`${path}: kit ${id} needs a label and slots`);
    for (const s of kit.slots) {
      if (!s.slot || !Number.isFinite(s.perNight) || s.perNight < 0 || !Array.isArray(s.options) || !s.options.length)
        throw new Error(`${path}: kit ${id}: bad slot ${JSON.stringify(s)}`);
      for (const o of s.options)
        if (!watch.has(o)) throw new Error(`${path}: kit ${id}, slot ${s.slot}: item ${o} isn't on the watchlist`);
    }
  }
}

export function kitList(cfg: Config): Kit[] {
  return Object.entries(cfg.kits).map(([id, k]) => ({ id, label: k.label, slots: k.slots }));
}

export function watchlistIds(cfg: Config): Set<number> {
  const ids = new Set<number>();
  for (const group of Object.values(cfg.watchlist)) for (const id of Object.keys(group ?? {})) ids.add(Number(id));
  return ids;
}
