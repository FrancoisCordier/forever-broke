import type { ItemMeta } from "../shared/types.ts";

/** The parts of `GET /data/wow/item/{id}` we read (A15, A21). */
export interface ItemResponse {
  name?: string;
  level?: number;
  quality?: { type?: string };
  item_class?: { name?: string };
  item_subclass?: { name?: string };
  preview_item?: {
    requirements?: { level?: { display_string?: string } };
    spells?: { description?: string }[];
    description?: string;
  };
}

/** Item metadata from the API response. Tooltip lines only when asked (watchlist items), to keep items.json small. */
export function itemMeta(d: ItemResponse, icon: number, withTip: boolean): ItemMeta {
  const meta: ItemMeta = {
    name: d.name ?? null,
    quality: d.quality?.type,
    cls: d.item_class?.name,
    sub: d.item_subclass?.name,
    level: d.level,
    icon,
  };
  if (withTip) meta.tip = tooltipLines(d);
  return meta;
}

/** "Requires Level 55", each "Use: …" effect, then the flavour text. Windows line breaks normalised. */
export function tooltipLines(d: ItemResponse): string[] {
  const p = d.preview_item ?? {};
  const lines = [
    p.requirements?.level?.display_string,
    ...(p.spells ?? []).map((s) => s.description),
    p.description ? `"${p.description}"` : undefined,
  ];
  return lines.filter((l): l is string => !!l).map((l) => l.replace(/\r\n/g, "\n").trim());
}

/**
 * Does this item need (re)fetching? Never seen; or seen before icons existed (A21); or now on the watchlist
 * without tooltip lines. Items the API 404'd (name null) are never retried.
 */
export function needsMeta(m: ItemMeta | undefined, watched: boolean): boolean {
  if (!m) return true;
  if (m.name === null) return false;
  return m.icon === undefined || (watched && m.tip === undefined);
}
