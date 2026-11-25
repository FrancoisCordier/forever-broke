import { readFile } from "node:fs/promises";
import { parse } from "yaml";

export interface HouseConfig {
  id: number;
  label: string;
  faction: string;
  set: string;
}

export interface Config {
  region: string;
  houses: HouseConfig[];
  /** group → item id → name (name is a human label only; the id is what counts). */
  watchlist: Record<string, Record<string, string>>;
  thresholds: Record<string, number>;
}

export async function loadConfig(path = "config.yaml"): Promise<Config> {
  const cfg = parse(await readFile(path, "utf8")) as Config;
  if (!cfg?.region || !Array.isArray(cfg.houses) || cfg.houses.length === 0) {
    throw new Error(`${path}: region and at least one house are required`);
  }
  for (const h of cfg.houses)
    if (!Number.isInteger(h.id)) throw new Error(`${path}: bad house id ${JSON.stringify(h)}`);
  cfg.watchlist ??= {};
  cfg.thresholds ??= {};
  return cfg;
}

export function watchlistIds(cfg: Config): Set<number> {
  const ids = new Set<number>();
  for (const group of Object.values(cfg.watchlist)) for (const id of Object.keys(group ?? {})) ids.add(Number(id));
  return ids;
}
