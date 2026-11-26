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
import {
  type BuyList,
  type BuyListItem,
  belowCraft,
  computeSignal,
  craftCost,
  type Ladder,
  ladderOf,
} from "../shared/signals.ts";
import type { DailySeries, HourlySeries, ItemMeta, Latest, Listing, Meta, Stats } from "../shared/types.ts";
import { Api } from "./api.ts";
import { type Config, type HouseConfig, kitList, loadConfig, watchlistIds } from "./config.ts";
import { loadRecipes, raidInfo } from "./raid.ts";
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
  let focus: FocusSnapshot | undefined;
  const onFocus = (f: FocusSnapshot) => {
    focus = f;
  };

  for (const house of cfg.houses) {
    try {
      const result = await collectHouse(
        api,
        house,
        meta,
        watch,
        seenItems,
        house.id === cfg.focusHouse ? onFocus : undefined,
      );
      log(`house ${house.id} (${house.label}): ${result}`);
      if (meta.houses[house.id].status !== "rejected") ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`house ${house.id} (${house.label}): ERROR ${msg}`);
      meta.houses[house.id] = { ...meta.houses[house.id], status: "error", error: msg, checkedAt: now() };
    }
  }

  // Watchlist items too: some (e.g. the new Forever flasks) may not be listed anywhere yet.
  const items = await updateItemMeta(api, new Set([...seenItems, ...watch]));
  // Unchanged snapshot: rebuild from stored files anyway, so config and recipe changes apply right away.
  focus ??= await focusFromDisk(cfg.focusHouse, meta, watch);
  if (focus) {
    const n = await writeBuyList(cfg, focus, items, watch);
    log(`buy list for house ${focus.house}: ${n} cheap items`);
  }

  meta.lastRun = now();
  meta.version = META_VERSION;
  await writeJson(metaPath, meta);
  await writeJson(join(DATA_DIR, "config.json"), {
    houses: cfg.houses,
    watchlist: cfg.watchlist,
    thresholds: cfg.thresholds,
    kits: cfg.kits,
  });

  if (ok === 0) {
    log("every house failed");
    process.exit(1);
  }
}

/** What the buy list needs from the focus house's fresh snapshot. */
interface FocusSnapshot {
  house: number;
  t: number;
  hourly: Map<number, HourlySeries>;
  ladders: Map<number, Ladder>;
}

async function collectHouse(
  api: Api,
  house: HouseConfig,
  meta: Meta,
  watch: Set<number>,
  seen: Set<number>,
  onFocus?: (f: FocusSnapshot) => void,
): Promise<string> {
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
    meta.houses[house.id] = {
      ...prev,
      status: "rejected",
      error: `empty response, previously ${prev?.listings} listings`,
      checkedAt: now(),
    };
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
  const hourly = new Map<number, HourlySeries>();
  await pool([...watch], 16, async (id) => {
    const p = join(dir, "hourly", `${id}.json`);
    const before = await readJson<HourlySeries>(p, emptyHourly());
    const after = appendHourly(before, t, stats.get(id));
    hourly.set(id, after);
    if (after !== before) await writeJson(p, after);
  });

  if (onFocus) {
    const byItem = new Map<number, Listing[]>();
    for (const l of listings) {
      const id = l.item?.id;
      if (!watch.has(id)) continue;
      const arr = byItem.get(id) ?? [];
      arr.push(l);
      byItem.set(id, arr);
    }
    const ladders = new Map<number, Ladder>();
    for (const id of watch) ladders.set(id, ladderOf(byItem.get(id) ?? []));
    onFocus({ house: house.id, t, hourly, ladders });
  }

  // daily: every item present in this snapshot
  await pool([...stats.entries()], 32, async ([id, s]: [number, Stats]) => {
    const p = join(dir, "daily", `${id}.json`);
    await writeJson(p, foldDaily(await readJson<DailySeries>(p, emptyDaily()), t, s));
  });

  const day = utcDate(t);
  meta.snapshotsPerDay[house.id] ??= {};
  const perDay = meta.snapshotsPerDay[house.id];
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
async function updateItemMeta(api: Api, seen: Set<number>): Promise<Record<string, ItemMeta>> {
  const path = join(DATA_DIR, "items.json");
  const items = await readJson<Record<string, ItemMeta>>(path, {});
  const missing = [...seen].filter((id) => !(id in items)).slice(0, MAX_NEW_ITEMS_PER_RUN);
  if (missing.length === 0) return items;
  let failed = 0;
  await pool(missing, 5, async (id) => {
    try {
      const d = (await api.item(id)) as {
        name?: string;
        level?: number;
        quality?: { type?: string };
        item_class?: { name?: string };
        item_subclass?: { name?: string };
      } | null;
      items[id] = d
        ? {
            name: d.name ?? null,
            quality: d.quality?.type,
            cls: d.item_class?.name,
            sub: d.item_subclass?.name,
            level: d.level,
          }
        : { name: null };
    } catch {
      failed++; // retried next run
    }
  });
  await writeJson(path, items);
  log(`item metadata: ${missing.length - failed} fetched, ${failed} failed`);
  return items;
}

/** Focus snapshot rebuilt from the stored hourly files and the previous buy list's ladders. */
async function focusFromDisk(house: number, meta: Meta, watch: Set<number>): Promise<FocusSnapshot | undefined> {
  const t = meta.houses[house]?.t;
  if (!t) return undefined;
  const dir = join(DATA_DIR, String(house));
  const prev = await readJson<BuyList | null>(join(dir, "buylist.json"), null);
  const prevLadders = new Map((prev?.items ?? []).map((x) => [x.id, x.ladder] as const));
  const hourly = new Map<number, HourlySeries>();
  const ladders = new Map<number, Ladder>();
  for (const id of watch) {
    hourly.set(id, await readJson<HourlySeries>(join(dir, "hourly", `${id}.json`), emptyHourly()));
    ladders.set(id, prevLadders.get(id) ?? []);
  }
  return { house, t, hourly, ladders };
}

/** Max ladder rows kept per item (enough to cover 2× normal price on any real market). */
const LADDER_ROWS = 25;

/** Write {focusHouse}/buylist.json: one entry per watchlist item, everything the site's buy list and item page need. */
async function writeBuyList(
  cfg: Config,
  focus: FocusSnapshot,
  items: Record<string, ItemMeta>,
  watch: Set<number>,
): Promise<number> {
  const raid = raidInfo(watch, items, await loadRecipes());
  const groupOf = new Map<number, string>();
  for (const [group, ids] of Object.entries(cfg.watchlist))
    for (const id of Object.keys(ids ?? {})) groupOf.set(Number(id), group);

  // Reagent prices come from latest.json (every item in the snapshot), so craft costs don't
  // depend on every reagent being on the watchlist. An NPC-sold reagent costs at most its vendor price.
  const latest = await readJson<Latest | null>(join(DATA_DIR, String(focus.house), "latest.json"), null);
  const priceOf = (id: number): number | null => {
    const ah = latest?.items[id]?.[1] ?? null; // p10
    const npc = cfg.vendorPrices[id] ?? null;
    if (ah === null) return npc;
    return npc === null ? ah : Math.min(ah, npc);
  };

  const list: BuyListItem[] = [];
  for (const id of watch) {
    const h = focus.hourly.get(id);
    const ladder = focus.ladders.get(id) ?? [];
    if (!h) continue;
    const signal = computeSignal(id, h, ladder, {
      cheapPct: cfg.thresholds.belowMedianPct,
      minUnitsListed: cfg.thresholds.minUnitsListed,
      minNormalDays: cfg.thresholds.minNormalDays,
    });
    if (!signal) continue;
    const info = raid.get(id);
    const recipe = info?.recipe ?? null;
    const vendorPrice = cfg.vendorPrices[id] ?? null;
    const cost = recipe && vendorPrice === null ? craftCost(recipe, priceOf).cost : null;
    list.push({
      ...signal,
      name: items[id]?.name ?? cfg.watchlist[groupOf.get(id) ?? ""]?.[id] ?? `Item ${id}`,
      quality: items[id]?.quality ?? null,
      group: groupOf.get(id) ?? "",
      raidProduct: info?.product ?? false,
      uses: info?.uses ?? [],
      vendorPrice,
      ladder: ladder.slice(0, LADDER_ROWS),
      recipe,
      craftCost: cost,
      ...belowCraft(signal.now, signal.qty, cost, {
        belowCraftPct: cfg.thresholds.belowCraftPct,
        minUnitsListed: cfg.thresholds.minUnitsListed,
      }),
    });
  }

  const reagentPrices: Record<string, number> = {};
  for (const x of list) {
    for (const r of x.recipe?.reagents ?? []) {
      const row = latest?.items[r.id];
      if (row) reagentPrices[r.id] = row[1]; // p10
    }
  }

  const out: BuyList = {
    house: focus.house,
    t: focus.t,
    raidOpens: cfg.raidOpens,
    cheapPct: cfg.thresholds.belowMedianPct,
    belowCraftPct: cfg.thresholds.belowCraftPct,
    kits: kitList(cfg),
    sell: {
      sellAboveCostPct: cfg.thresholds.sellAboveCostPct,
      sellAboveNormalPct: cfg.thresholds.sellAboveNormalPct,
    },
    items: list,
    reagentPrices,
  };
  await writeJson(join(DATA_DIR, String(focus.house), "buylist.json"), out);
  return list.filter((x) => x.cheap).length;
}

const now = () => Math.floor(Date.now() / 1000);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
