import { readFile } from "node:fs/promises";
import { parse } from "yaml";

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
}

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
}

const DEFAULT_THRESHOLDS: Thresholds = { belowMedianPct: 20, minUnitsListed: 20, minNormalDays: 1 };

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
  return cfg;
}

export function watchlistIds(cfg: Config): Set<number> {
  const ids = new Set<number>();
  for (const group of Object.values(cfg.watchlist)) for (const id of Object.keys(group ?? {})) ids.add(Number(id));
  return ids;
}
