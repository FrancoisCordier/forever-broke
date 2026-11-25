/**
 * Resolve / verify item IDs against the static Forever namespace.
 *   pnpm resolve-items 13468 13510          → print id → name, quality, class
 *   pnpm resolve-items --search "Flask of"  → search by English name (A15/A17)
 */
const HOST = "https://eu.api.blizzard.com";
const NS = "static-forever-eu";

async function token(): Promise<string> {
  const id = process.env.BNET_CLIENT_ID,
    secret = process.env.BNET_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing BNET_CLIENT_ID / BNET_CLIENT_SECRET in .env");
  const res = await fetch("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  return ((await res.json()) as { access_token: string }).access_token;
}

interface Item {
  id: number;
  name: unknown;
  quality?: { type?: string };
  item_class?: { name?: unknown };
  item_subclass?: { name?: unknown };
}
const en = (v: unknown) =>
  typeof v === "string" ? v : ((v as Record<string, string> | undefined)?.en_GB ?? JSON.stringify(v));

async function main() {
  const t = await token();
  const args = process.argv.slice(2);
  if (args[0] === "--search") {
    const q = encodeURIComponent(args.slice(1).join(" "));
    const url = `${HOST}/data/wow/search/item?namespace=${NS}&name.en_GB=${q}&orderby=id&_pageSize=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
    const body = (await res.json()) as { results?: { data: Item }[] };
    console.log(`HTTP ${res.status}, ${body.results?.length ?? 0} results`);
    for (const r of body.results ?? []) {
      const d = r.data;
      console.log(
        `  ${d.id}\t${en(d.name)}\t${d.quality?.type ?? ""}\t${en(d.item_class?.name)}/${en(d.item_subclass?.name)}`,
      );
    }
    if (!body.results) console.log(JSON.stringify(body).slice(0, 500));
    return;
  }
  for (const id of args.map(Number)) {
    const res = await fetch(`${HOST}/data/wow/item/${id}?namespace=${NS}&locale=en_GB`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) {
      console.log(`  ${id}\tHTTP ${res.status}`);
      continue;
    }
    const d = (await res.json()) as Item;
    console.log(
      `  ${id}\t${en(d.name)}\t${d.quality?.type ?? ""}\t${en(d.item_class?.name)}/${en(d.item_subclass?.name)}`,
    );
  }
}
main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
