/** The viewer's own kits (ADR-0014): copies of a default kit they edit, kept in this browser, shared by link. */
import { useEffect, useState } from "react";
import type { Kit, KitSlot } from "../../../src/shared/signals.ts";
import type { KitRow } from "./kit.ts";

const KEY = "forever-broke.customKits";
export const CUSTOM_PREFIX = "custom-";

export const isCustom = (kit: Kit) => kit.id.startsWith(CUSTOM_PREFIX);

export function useCustomKits(): [Kit[], (kits: Kit[]) => void] {
  const [kits, setKits] = useState<Kit[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      return Array.isArray(saved) ? saved.map(toKit).filter((k): k is Kit => k !== null) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(kits));
    } catch {
      // storage blocked: custom kits last until the tab closes
    }
  }, [kits]);
  return [kits, setKits];
}

const newId = () => `${CUSTOM_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A custom copy of `kit` that starts from what the viewer sees now: chosen items first, their units per night. */
export function customise(kit: Kit, rows: KitRow[]): Kit {
  const byKey = new Map(rows.map((r) => [r.slot, r]));
  return {
    id: newId(),
    class: kit.class,
    spec: kit.spec,
    label: isCustom(kit) ? `${kit.label} (copy)` : `My ${kit.spec}`,
    slots: kit.slots.map((s) => {
      const r = byKey.get(s.slot);
      const chosen = r?.item?.id;
      const options = chosen ? [chosen, ...s.options.filter((o) => o !== chosen)] : s.options;
      // dps belongs to the guide's choice and settings; a custom kit keeps only what the viewer set.
      return { slot: s.slot, perNight: r?.perNight ?? s.perNight, options, ...(s.note ? { note: s.note } : {}) };
    }),
  };
}

/** A shared kit as it arrives, with a fresh id so it never overwrites one of the viewer's own. */
export const adopt = (kit: Kit): Kit => ({ ...kit, id: newId() });

// Share links carry the kit as base64url JSON in `#/kit?share=…`. Only what a kit needs travels.
export function encodeKit(kit: Kit): string {
  const json = JSON.stringify({ c: kit.class, s: kit.spec, l: kit.label, sl: kit.slots });
  const bytes = new TextEncoder().encode(json);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeKit(text: string): Kit | null {
  try {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
    const x = JSON.parse(json);
    return toKit({ id: newId(), class: x.c, spec: x.s, label: x.l, slots: x.sl });
  } catch {
    return null;
  }
}

/** Validate a kit from storage or a link: anything malformed is dropped, not trusted. */
function toKit(x: unknown): Kit | null {
  const k = x as Partial<Kit> | null;
  if (!k || typeof k.id !== "string" || typeof k.class !== "string" || typeof k.spec !== "string") return null;
  if (typeof k.label !== "string" || !Array.isArray(k.slots)) return null;
  const slots: KitSlot[] = [];
  for (const s of k.slots as Partial<KitSlot>[]) {
    if (typeof s?.slot !== "string" || !Array.isArray(s.options)) return null;
    const options = s.options.filter((o): o is number => Number.isInteger(o));
    if (!options.length) continue;
    const perNight = Number.isFinite(s.perNight) ? Math.max(0, Math.floor(s.perNight as number)) : 0;
    slots.push({
      slot: s.slot.slice(0, 60),
      perNight,
      options,
      ...(typeof s.note === "string" ? { note: s.note } : {}),
    });
  }
  return { id: k.id, class: k.class.slice(0, 30), spec: k.spec.slice(0, 60), label: k.label.slice(0, 60), slots };
}
