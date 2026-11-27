import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { customise, decodeKit, encodeKit, isCustom } from "../site/src/lib/customKits.ts";
import { defaultOption, type KitPrefs, kitRows, kitsByClass } from "../site/src/lib/kit.ts";
import { kitList, loadConfig } from "../src/collector/config.ts";
import type { BuyListItem, Kit } from "../src/shared/signals.ts";

const item = (id: number, now: number | null, qty = 100): BuyListItem =>
  ({ id, name: `Item ${id}`, now, qty, ladder: now === null ? [] : [[now, qty]] }) as unknown as BuyListItem;

const prefs: KitPrefs = { kit: "k", nights: 2, choice: {}, perNight: {} };

describe("defaultOption (ADR-0014)", () => {
  const a = item(1, 500);
  const b = item(2, 300);
  const bound = item(3, null);

  it("starts on the first option the AH can have", () => {
    expect(defaultOption([bound, a, b], new Set([3]))?.id).toBe(1);
    expect(defaultOption([a, b], new Set())?.id).toBe(1);
  });

  it("falls back to a soulbound option when there is nothing else", () => {
    expect(defaultOption([bound], new Set([3]))?.id).toBe(3);
  });

  it("picks the cheapest listed option when the slot says they're interchangeable", () => {
    expect(defaultOption([a, b, item(4, null)], new Set(), true)?.id).toBe(2);
  });
});

describe("kitRows with soulbound items", () => {
  const kit: Kit = {
    id: "k",
    class: "Hunter",
    spec: "Marksmanship",
    label: "Hunter · Marksmanship",
    slots: [
      { slot: "Scorpok", perNight: 3, options: [8412] },
      { slot: "Agility elixir", perNight: 6, options: [13452] },
    ],
  };
  const items = [item(8412, null), item(13452, 1000)];

  it("costs nothing and is flagged, while tradeable slots are priced", () => {
    const [scorpok, mongoose] = kitRows(kit, items, prefs, new Set([8412]));
    expect(scorpok).toMatchObject({ soulbound: true, need: 6, cost: 0, units: 0 });
    expect(mongoose).toMatchObject({ soulbound: false, need: 12, cost: 12000, units: 12 });
  });
});

describe("kitsByClass", () => {
  it("groups kits by class in first-seen order", () => {
    const k = (id: string, cls: string) => ({ id, class: cls, spec: id, label: id, slots: [] });
    const groups = kitsByClass([k("mm", "Hunter"), k("fire", "Mage"), k("bm", "Hunter")]);
    expect(groups.map(([c, ks]) => [c, ks.map((x) => x.id)])).toEqual([
      ["Hunter", ["mm", "bm"]],
      ["Mage", ["fire"]],
    ]);
  });
});

describe("custom kits", () => {
  const base: Kit = {
    id: "mage_fire",
    class: "Mage",
    spec: "Fire",
    label: "Mage · Fire",
    source: { name: "Wowhead", url: "https://example.org", date: "2026-11-26" },
    slots: [{ slot: "Food", perNight: 12, options: [13933, 13935], note: "Spell power food", dps: 9 }],
  };

  it("copies what the viewer sees: chosen item first, their units per night, no guide DPS", () => {
    const rows = kitRows(base, [item(13933, 100), item(13935, 90)], {
      ...prefs,
      choice: { "mage_fire:Food": 13935 },
      perNight: { "mage_fire:Food": 8 },
    });
    const mine = customise(base, rows);
    expect(isCustom(mine)).toBe(true);
    expect(mine.label).toBe("My Fire");
    expect(mine.slots).toEqual([{ slot: "Food", perNight: 8, options: [13935, 13933], note: "Spell power food" }]);
  });

  it("round-trips through a share link with a fresh id", () => {
    const back = decodeKit(encodeKit(base));
    expect(back).toMatchObject({ class: "Mage", spec: "Fire", label: "Mage · Fire" });
    expect(back?.slots).toEqual([{ slot: "Food", perNight: 12, options: [13933, 13935], note: "Spell power food" }]);
    expect(back?.id).not.toBe(base.id);
    expect(isCustom(back as Kit)).toBe(true);
  });

  it("rejects a malformed link", () => {
    expect(decodeKit("not-base64!")).toBeNull();
    expect(decodeKit(btoa(JSON.stringify({ c: 1 })))).toBeNull();
  });
});

describe("config.yaml kits", () => {
  it("loads every kit with a class, a spec and watchlisted items", async () => {
    const cfg = await loadConfig("config.yaml");
    const kits = kitList(cfg);
    expect(kits.length).toBeGreaterThanOrEqual(9);
    for (const k of kits) expect(k.label).toBe(`${k.class} · ${k.spec}`);
    expect(cfg.soulbound).toContain(8412);
  });

  it("rejects a flow-style note split by an unquoted comma", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kits-"));
    const text = (await readFile("config.yaml", "utf8")).replace("note: Mana. }", "note: Mana, for turret. }");
    await writeFile(join(dir, "config.yaml"), text);
    await expect(loadConfig(join(dir, "config.yaml"))).rejects.toThrow(/unknown keys/);
  });
});
