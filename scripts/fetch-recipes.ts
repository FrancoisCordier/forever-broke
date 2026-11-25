/**
 * Download every profession recipe (with reagents) from static-forever-eu into recipes.json.
 * Verified source for craft margins: no hand-copied recipes from guides (A16).
 *   pnpm fetch-recipes
 */
import { writeFile } from "node:fs/promises";

const HOST = "https://eu.api.blizzard.com";
const NS = "static-forever-eu";
const SKIP = new Set(["Test Profession [DNT]"]);

interface Ref {
  id: number;
  name: string;
}
export interface Recipe {
  id: number;
  name: string;
  profession: string;
  category: string;
  item: Ref | null;
  makes: number;
  reagents: { id: number; name: string; qty: number }[];
}

let token = "";
async function get<T>(path: string): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${HOST}${path}?namespace=${NS}&locale=en_GB`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return null;
    if (res.ok) return (await res.json()) as T;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`GET ${path} failed`);
}

async function main() {
  const id = process.env.BNET_CLIENT_ID,
    secret = process.env.BNET_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing BNET_CLIENT_ID / BNET_CLIENT_SECRET in .env");
  token = (
    (await (
      await fetch("https://oauth.battle.net/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      })
    ).json()) as { access_token: string }
  ).access_token;

  const idx = await get<{ professions: Ref[] }>("/data/wow/profession/index");
  const todo: { profession: string; category: string; id: number }[] = [];
  for (const p of idx?.professions ?? []) {
    if (SKIP.has(p.name)) continue;
    const prof = await get<{ skill_tiers?: Ref[] }>(`/data/wow/profession/${p.id}`);
    for (const tier of prof?.skill_tiers ?? []) {
      const st = await get<{ categories?: { name: string; recipes: Ref[] }[] }>(
        `/data/wow/profession/${p.id}/skill-tier/${tier.id}`,
      );
      for (const c of st?.categories ?? [])
        for (const r of c.recipes) todo.push({ profession: p.name, category: c.name, id: r.id });
    }
  }
  console.log(`${todo.length} recipes to fetch`);

  const out: Recipe[] = [];
  let i = 0,
    done = 0;
  const worker = async () => {
    while (i < todo.length) {
      const t = todo[i++];
      const r = await get<{
        id: number;
        name: string;
        crafted_item?: Ref;
        crafted_quantity?: { value?: number; minimum?: number };
        reagents?: { reagent: Ref; quantity: number }[];
      }>(`/data/wow/recipe/${t.id}`);
      if (r) {
        out.push({
          id: r.id,
          name: r.name,
          profession: t.profession,
          category: t.category,
          item: r.crafted_item ? { id: r.crafted_item.id, name: r.crafted_item.name } : null,
          makes: r.crafted_quantity?.value ?? r.crafted_quantity?.minimum ?? 1,
          reagents: (r.reagents ?? []).map((x) => ({ id: x.reagent.id, name: x.reagent.name, qty: x.quantity })),
        });
      }
      if (++done % 200 === 0) console.log(`  ${done}/${todo.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  out.sort((a, b) => a.profession.localeCompare(b.profession) || a.category.localeCompare(b.category) || a.id - b.id);
  await writeFile(
    "recipes.json",
    `${JSON.stringify({ fetched: new Date().toISOString(), source: NS, recipes: out }, null, 1)}\n`,
  );
  console.log(`wrote recipes.json: ${out.length} recipes`);
}
main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
