/**
 * Phase 0: explore the Battle.net Game Data API for WoW Forever (EU).
 *
 * Nothing about the API is verified yet (see docs/api-notes.md), so this script assumes
 * as little as possible about response shapes: it prints what it finds and saves every
 * raw response under explore-output/ so we can inspect them and build test fixtures.
 *
 * Usage: pnpm explore            (needs BNET_CLIENT_ID / BNET_CLIENT_SECRET in .env)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const HOST = "https://eu.api.blizzard.com"; // A2
const TOKEN_URL = "https://oauth.battle.net/token"; // A1
const NS_DYNAMIC = "dynamic-forever-eu"; // A3
const NS_STATIC = "static-forever-eu"; // A3
const LOCALE = "en_GB";
const OUT_DIR = "explore-output";

/** Well-known Classic item IDs, used to compare prices with in-game. Names are checked against the static API. */
const PROBE_ITEMS: Record<number, string> = {
  13468: "Black Lotus",
  8846: "Gromsblood",
  13463: "Dreamfoil",
  13465: "Mountain Silversage",
  8925: "Crystal Vial",
  7068: "Elemental Fire",
  13510: "Flask of the Titans",
  12360: "Arcanite Bar",
};

type Json = unknown;

async function getToken(): Promise<string> {
  const id = process.env.BNET_CLIENT_ID;
  const secret = process.env.BNET_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Missing BNET_CLIENT_ID / BNET_CLIENT_SECRET. Copy .env.example to .env and fill it in.");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error(`Token response has no access_token: ${JSON.stringify(body)}`);
  return body.access_token;
}

interface ApiResult {
  status: number;
  lastModified: string | null;
  bytes: number;
  ms: number;
  body: Json | null;
}

async function api(token: string, path: string, namespace: string, saveAs: string): Promise<ApiResult> {
  const url = `${HOST}${path}?namespace=${namespace}&locale=${LOCALE}`;
  const t0 = performance.now();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  const ms = Math.round(performance.now() - t0);
  await writeFile(join(OUT_DIR, `${saveAs}.json`), text);
  let body: Json | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON error page: kept on disk */
  }
  return { status: res.status, lastModified: res.headers.get("last-modified"), bytes: text.length, ms, body };
}

/** Find all {id, name?} objects under any key whose name mentions "auction" or "house". Shape-agnostic. */
function findHouses(node: Json, inHouseKey = false, acc = new Map<number, string>()): Map<number, string> {
  if (Array.isArray(node)) {
    for (const x of node) findHouses(x, inHouseKey, acc);
  } else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (inHouseKey && typeof o.id === "number") {
      acc.set(o.id, typeof o.name === "string" ? o.name : JSON.stringify(o.name ?? ""));
    }
    for (const [k, v] of Object.entries(o)) {
      if (k === "_links" || k === "key") continue;
      findHouses(v, inHouseKey || /auction|house/i.test(k), acc);
    }
  }
  return acc;
}

/** Find {id} objects in the ruleset index (any array of objects with numeric ids). */
function findIds(node: Json, acc: { id: number; name: string }[] = []): { id: number; name: string }[] {
  if (Array.isArray(node)) {
    for (const x of node) findIds(x, acc);
  } else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.id === "number")
      acc.push({ id: o.id, name: typeof o.name === "string" ? o.name : JSON.stringify(o.name ?? "") });
    for (const [k, v] of Object.entries(o)) if (k !== "_links" && k !== "key") findIds(v, acc);
  }
  return acc;
}

function gsc(copper: number): string {
  const g = Math.floor(copper / 10000);
  const s = Math.floor((copper % 10000) / 100);
  const c = copper % 100;
  return `${g}g ${s}s ${c}c`;
}

interface Listing {
  item?: { id?: number };
  quantity?: number;
  unit_price?: number;
}

function summariseCommodities(body: Json) {
  const auctions = (body as { auctions?: Listing[] } | null)?.auctions;
  if (!Array.isArray(auctions)) return null;
  const items = new Set<number>();
  let qty = 0;
  const probeMin = new Map<number, { min: number; qty: number }>();
  for (const a of auctions) {
    const id = a.item?.id;
    if (typeof id === "number") items.add(id);
    qty += a.quantity ?? 0;
    if (typeof id === "number" && id in PROBE_ITEMS && typeof a.unit_price === "number") {
      const p = probeMin.get(id) ?? { min: Infinity, qty: 0 };
      p.min = Math.min(p.min, a.unit_price);
      p.qty += a.quantity ?? 0;
      probeMin.set(id, p);
    }
  }
  return { listings: auctions.length, items: items.size, qty, probeMin, sample: auctions[0] };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const token = await getToken();
  console.log("✓ token OK (A1)\n");

  // 1. Ruleset index
  const idx = await api(token, "/data/wow/ruleset/index", NS_DYNAMIC, "ruleset-index");
  console.log(`ruleset index: HTTP ${idx.status}, ${idx.bytes} bytes`);
  if (idx.status !== 200) {
    console.log(
      "  → body saved to explore-output/ruleset-index.json. Stopping: the endpoint/namespace assumption (A3/A4) is wrong.",
    );
    return;
  }
  const rulesets = findIds(idx.body);
  for (const r of rulesets) console.log(`  ruleset ${r.id}: ${r.name}`);

  // 2. Each ruleset → auction houses
  const housesByRuleset = new Map<number, Map<number, string>>();
  for (const r of rulesets) {
    // Ruleset detail has {name, status, auctions: {href}}; houses are behind that link (verified 2026-11-25).
    const det = await api(token, `/data/wow/ruleset/${r.id}`, NS_DYNAMIC, `ruleset-${r.id}`);
    const d = det.body as { name?: unknown; status?: { type?: string }; auctions?: { href?: string } } | null;
    r.name = typeof d?.name === "string" ? d.name : r.name;
    const href = d?.auctions?.href;
    const path = href ? new URL(href).pathname : `/data/wow/ruleset/${r.id}/auctions/`;
    const res = await api(token, path, NS_DYNAMIC, `ruleset-${r.id}-auctions`);
    const houses = res.body ? findHouses(res.body) : new Map<number, string>();
    housesByRuleset.set(r.id, houses);
    console.log(
      `\nruleset ${r.id} (${r.name}, ${d?.status?.type ?? "?"}): ${path} → HTTP ${res.status}, ${houses.size} houses`,
    );
    for (const [id, name] of houses) console.log(`  house ${id}: ${name}`);
  }

  const allHouses = new Map<number, { name: string; rulesets: number[] }>();
  for (const [rid, houses] of housesByRuleset)
    for (const [hid, name] of houses) {
      const h = allHouses.get(hid) ?? { name, rulesets: [] };
      h.rulesets.push(rid);
      allHouses.set(hid, h);
    }
  if (allHouses.size === 0) {
    console.log("\nNo houses found. Inspect explore-output/ruleset-*.json and adjust findHouses().");
    return;
  }

  // 3. Commodities per house (via the first ruleset that lists it)
  console.log(`\n=== commodities for ${allHouses.size} unique houses ===`);
  const report: Record<string, unknown>[] = [];
  for (const [hid, h] of allHouses) {
    const rid = h.rulesets[0];
    const res = await api(
      token,
      `/data/wow/ruleset/${rid}/auctions/${hid}/commodities`,
      NS_DYNAMIC,
      `commodities-${hid}`,
    );
    const s = res.status === 200 ? summariseCommodities(res.body) : null;
    console.log(
      `\nhouse ${hid} "${h.name}" (rulesets ${h.rulesets.join(",")}): HTTP ${res.status}, ` +
        `${(res.bytes / 1e6).toFixed(1)} MB, ${res.ms} ms, Last-Modified: ${res.lastModified ?? "—"}`,
    );
    if (!s) {
      console.log("  (no auctions[] array; see saved file)");
      continue;
    }
    console.log(`  ${s.listings} listings, ${s.items} distinct items, ${s.qty} units`);
    if (report.length === 0 && s.sample) console.log(`  sample listing (A10): ${JSON.stringify(s.sample)}`);
    for (const [id, name] of Object.entries(PROBE_ITEMS)) {
      const p = s.probeMin.get(Number(id));
      console.log(`    ${name.padEnd(22)} ${p ? `${gsc(p.min).padStart(14)}  (${p.qty} listed)` : "—"}`);
    }
    report.push({
      house: hid,
      name: h.name,
      rulesets: h.rulesets,
      listings: s.listings,
      items: s.items,
      lastModified: res.lastModified,
    });
  }
  // 4. Does If-Modified-Since work? (A13) Retry the first non-empty house.
  const probe = report.find((r) => (r.listings as number) > 0);
  if (probe?.lastModified) {
    const rid = (probe.rulesets as number[])[0];
    const res = await fetch(
      `${HOST}/data/wow/ruleset/${rid}/auctions/${probe.house}/commodities?namespace=${NS_DYNAMIC}&locale=${LOCALE}`,
      {
        headers: { Authorization: `Bearer ${token}`, "If-Modified-Since": probe.lastModified as string },
      },
    );
    await res.body?.cancel();
    console.log(`\nIf-Modified-Since on house ${probe.house}: HTTP ${res.status} (304 = supported)`);
  }

  // 5. Ruleset in path ignored? (A7) Same house via a different ruleset.
  if (probe && rulesets.length > 1) {
    const other = rulesets.find((r) => r.id !== (probe.rulesets as number[])[0]);
    if (other) {
      const res = await api(
        token,
        `/data/wow/ruleset/${other.id}/auctions/${probe.house}/commodities`,
        NS_DYNAMIC,
        `commodities-${probe.house}-via-${other.id}`,
      );
      const s = res.status === 200 ? summariseCommodities(res.body) : null;
      console.log(
        `House ${probe.house} via ruleset ${other.id}: HTTP ${res.status}, ${s?.listings ?? "?"} listings (vs ${probe.listings})`,
      );
    }
  }

  // 6. Item names from the static namespace (A15): confirms probe IDs are what we think.
  console.log("\n=== static item check ===");
  for (const [id, expected] of Object.entries(PROBE_ITEMS)) {
    const res = await api(token, `/data/wow/item/${id}`, NS_STATIC, `item-${id}`);
    const name = (res.body as { name?: unknown } | null)?.name;
    console.log(
      `  ${id}: HTTP ${res.status} → ${typeof name === "string" ? name : JSON.stringify(name)} ${name === expected ? "✓" : `(expected ${expected})`}`,
    );
  }

  await writeFile(join(OUT_DIR, "summary.json"), JSON.stringify(report, null, 2));
  console.log(`\nRaw responses + summary.json saved in ${OUT_DIR}/ (gitignored).`);
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
