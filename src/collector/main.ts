/**
 * Hourly collector (phase 1). See docs/architecture.md.
 *
 * Env:
 *   BNET_CLIENT_ID / BNET_CLIENT_SECRET  required
 *   DATA_DIR   where the data tree lives (default ./out/data); previous run's files are read from here
 *   RAW_DIR    if set, raw responses are saved there gzipped (uploaded as a workflow artifact, ADR-0004)
 *
 * Exit code: 0 if at least one house was updated or unchanged, 1 if every house failed.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { aggregate } from "../shared/aggregate.ts";
import { appendHourly, emptyDaily, emptyHourly, foldDaily, utcDate } from "../shared/series.ts";
import type { DailySeries, HourlySeries, ItemMeta, Latest, Meta, Stats } from "../shared/types.ts";
import { Api } from "./api.ts";
import { loadConfig, watchlistIds, type HouseConfig } from "./config.ts";
import { pool, readJson, writeJson } from "./store.ts";

const DATA_DIR = process.env.DATA_DIR ?? "out/data";
const RAW_DIR = process.env.RAW_DIR;
const META_VERSION = 1;
const MAX_NEW_ITEMS_PER_RUN = 3000;
/** A house that had this many listings and suddenly returns none is treated as an API glitch. */
const EMPTY_GUARD_MIN_LISTINGS = 1000;

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`);

async function main() {
  const cfg = await loadConfig();
  const watch = watchlistIds(cfg);
  const api = new Api(cfg.region);
  await api.authenticate();

  const metaPath = join(DATA_DIR, "meta.json");
  const meta = await readJson<Meta>(metaPath, { version: META_VERSION, lastRun: 0, houses: {}, snapshotsPerDay: {} });
  const seenItems = new Set<number>();
  let ok = 0;

  for (const house of cfg.houses) {
    try {
      const result = await collectHouse(api, house, meta, watch, seenItems);
      log(`house ${house.id} (${house.label}): ${result}`);
      if (meta.houses[house.id].status !== "rejected") ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`house ${house.id} (${house.label}): ERROR ${msg}`);
      meta.houses[house.id] = { ...meta.houses[house.id], status: "error", error: msg, checkedAt: now() };
    }
  }

  await updateItemMeta(api, seenItems);

  meta.lastRun = now();
  meta.version = META_VERSION;
  await writeJson(metaPath, meta);
  await writeJson(join(DATA_DIR, "config.json"), { houses: cfg.houses, watchlist: cfg.watchlist, thresholds: cfg.thresholds });

  if (ok === 0) {
    log("every house failed");
    process.exit(1);
  }
}

async function collectHouse(api: Api, house: HouseConfig, meta: Meta, watch: Set<number>, seen: Set<number>): Promise<string> {
  const prev = meta.houses[house.id];
  const res = await api.commodities(house.id, prev?.lastModified);
  if (res.status === "unchanged") {
    meta.houses[house.id] = { ...prev, status: "unchanged", error: undefined, checkedAt: now() };
    return "unchanged (304)";
  }
  if (res.lastModified && res.lastModified === prev?.lastModified) {
    meta.houses[house.id] = { ...prev, status: "unchanged", error: undefined, checkedAt: now() };
    return "unchanged (same Last-Modified)";
  }

  const listings = res.listings ?? [];
  if (listings.length === 0 && (prev?.listings ?? 0) >= EMPTY_GUARD_MIN_LISTINGS) {
    meta.houses[house.id] = { ...prev, status: "rejected", error: `empty response, previously ${prev?.listings} listings`, checkedAt: now() };
    return "REJECTED empty response (kept previous data)";
  }

  // Snapshot time = API Last-Modified, not the job's clock (cron runs late, ADR/architecture "Time").
  const t = res.lastModified ? Math.floor(Date.parse(res.lastModified) / 1000) : now();
  const stats = aggregate(listings);
  for (const id of stats.keys()) seen.add(id);

  if (RAW_DIR) {
    await mkdir(RAW_DIR, { recursive: true });
    await writeFile(join(RAW_DIR, `${house.id}-${t}.json.gz`), gzipSync(res.raw));
  }

  const dir = join(DATA_DIR, String(house.id));

  // latest.json
  const latest: Latest = { house: house.id, t, items: {} };
  for (const [id, s] of stats) latest.items[id] = [s.min, s.p10, s.median, s.qty, s.listings];
  await writeJson(join(dir, "latest.json"), latest);

  // hourly: watchlist items, including a qty-0 point when absent
  await pool([...watch], 16, async (id) => {
    const p = join(dir, "hourly", `${id}.json`);
    const before = await readJson<HourlySeries>(p, emptyHourly());
    const after = appendHourly(before, t, stats.get(id));
    if (after !== before) await writeJson(p, after);
  });

  // daily: every item present in this snapshot
  await pool([...stats.entries()], 32, async ([id, s]: [number, Stats]) => {
    const p = join(dir, "daily", `${id}.json`);
    await writeJson(p, foldDaily(await readJson<DailySeries>(p, emptyDaily()), t, s));
  });

  const day = utcDate(t);
  const perDay = (meta.snapshotsPerDay[house.id] ??= {});
  perDay[day] = (perDay[day] ?? 0) + 1;

  meta.houses[house.id] = {
    lastModified: res.lastModified ?? undefined,
    t,
    status: "updated",
    listings: listings.length,
    items: stats.size,
    checkedAt: now(),
  };
  return `updated: ${listings.length} listings, ${stats.size} items, snapshot ${new Date(t * 1000).toISOString()}`;
}

/** Fetch metadata for items we have never seen. 404s are cached as {name:null} so they aren't retried every hour. */
async function updateItemMeta(api: Api, seen: Set<number>) {
  const path = join(DATA_DIR, "items.json");
  const items = await readJson<Record<string, ItemMeta>>(path, {});
  const missing = [...seen].filter((id) => !(id in items)).slice(0, MAX_NEW_ITEMS_PER_RUN);
  if (missing.length === 0) return;
  let failed = 0;
  await pool(missing, 5, async (id) => {
    try {
      const d = (await api.item(id)) as {
        name?: string; level?: number; quality?: { type?: string };
        item_class?: { name?: string }; item_subclass?: { name?: string };
      } | null;
      items[id] = d
        ? { name: d.name ?? null, quality: d.quality?.type, cls: d.item_class?.name, sub: d.item_subclass?.name, level: d.level }
        : { name: null };
    } catch {
      failed++; // retried next run
    }
  });
  await writeJson(path, items);
  log(`item metadata: ${missing.length - failed} fetched, ${failed} failed`);
}

const now = () => Math.floor(Date.now() / 1000);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
