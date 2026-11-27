import { describe, expect, it } from "vitest";
import { itemMeta, needsMeta, tooltipLines } from "../src/collector/itemMeta.ts";

// Trimmed from GET /data/wow/item/274274, static-forever-eu, 2026-11-27.
const flask = {
  name: "Flask of Natural Aggression",
  level: 55,
  quality: { type: "UNCOMMON" },
  item_class: { name: "Consumable" },
  item_subclass: { name: "Flasks" },
  preview_item: {
    requirements: { level: { display_string: "Requires Level 55" } },
    spells: [{ description: "Use: Increases your Stamina by 30.\r\n\r\nLasts for 2 hrs." }],
  },
};

describe("itemMeta", () => {
  it("keeps the icon, and tooltip lines only when asked", () => {
    expect(itemMeta(flask, 463898, false)).toEqual({
      name: "Flask of Natural Aggression",
      quality: "UNCOMMON",
      cls: "Consumable",
      sub: "Flasks",
      level: 55,
      icon: 463898,
    });
    expect(itemMeta(flask, 463898, true).tip).toEqual([
      "Requires Level 55",
      "Use: Increases your Stamina by 30.\n\nLasts for 2 hrs.",
    ]);
  });

  it("quotes the flavour text and skips what's missing", () => {
    expect(tooltipLines({ preview_item: { description: "Smells nice." } })).toEqual(['"Smells nice."']);
    expect(tooltipLines({})).toEqual([]);
  });
});

describe("needsMeta", () => {
  it("fetches new items, backfills icons and watchlist tooltips, never retries 404s", () => {
    expect(needsMeta(undefined, false)).toBe(true);
    expect(needsMeta({ name: null }, true)).toBe(false);
    expect(needsMeta({ name: "x" }, false)).toBe(true);
    expect(needsMeta({ name: "x", icon: 1 }, false)).toBe(false);
    expect(needsMeta({ name: "x", icon: 1 }, true)).toBe(true);
    expect(needsMeta({ name: "x", icon: 0, tip: [] }, true)).toBe(false);
  });
});
