import { describe, expect, it } from "vitest";
import { appendHourly, emptyDaily, emptyHourly, foldDaily, HOURLY_RETENTION_S } from "../src/shared/series.ts";
import { formatGold } from "../src/shared/gold.ts";
import type { Stats } from "../src/shared/types.ts";

const s = (min: number, qty = 10): Stats => ({ min, p10: min + 1, median: min + 2, qty, listings: 1 });
const T0 = Date.UTC(2026, 10, 25, 16) / 1000;

describe("appendHourly", () => {
  it("appends and records absence as qty 0 with null prices", () => {
    let h = appendHourly(emptyHourly(), T0, s(100));
    h = appendHourly(h, T0 + 3600, undefined);
    expect(h.t).toEqual([T0, T0 + 3600]);
    expect(h.min).toEqual([100, null]);
    expect(h.qty).toEqual([10, 0]);
  });

  it("ignores duplicate or older snapshots", () => {
    const h = appendHourly(emptyHourly(), T0, s(100));
    expect(appendHourly(h, T0, s(999))).toBe(h);
    expect(appendHourly(h, T0 - 1, s(999))).toBe(h);
  });

  it("drops points older than 30 days", () => {
    let h = appendHourly(emptyHourly(), T0, s(1));
    h = appendHourly(h, T0 + 3600, s(2));
    h = appendHourly(h, T0 + HOURLY_RETENTION_S + 1800, s(3));
    expect(h.t).toEqual([T0 + 3600, T0 + HOURLY_RETENTION_S + 1800]);
    expect(h.min).toEqual([2, 3]);
  });
});

describe("foldDaily", () => {
  it("averages within a UTC day and keeps the lowest min", () => {
    let d = foldDaily(emptyDaily(), T0, s(100, 10));
    d = foldDaily(d, T0 + 3600, s(80, 20));
    d = foldDaily(d, T0 + 7200, s(120, 30));
    expect(d.d).toEqual(["2026-11-25"]);
    expect(d.min).toEqual([80]);
    expect(d.p10).toEqual([101]); // mean of 101, 81, 121
    expect(d.qty).toEqual([20]);
    expect(d.n).toEqual([3]);
  });

  it("starts a new entry on the next UTC day", () => {
    let d = foldDaily(emptyDaily(), T0, s(100));
    d = foldDaily(d, T0 + 9 * 3600, s(50)); // 2026-11-26 01:00 UTC
    expect(d.d).toEqual(["2026-11-25", "2026-11-26"]);
    expect(d.min).toEqual([100, 50]);
  });
});

describe("formatGold", () => {
  it.each([
    [123456, "12g 34s 56c"],
    [97595, "9g 75s 95c"],
    [3456, "34s 56c"],
    [5, "5c"],
    [0, "0c"],
    [10000, "1g 0s 0c"],
    [-250, "-2s 50c"],
  ])("%i → %s", (c, out) => expect(formatGold(c)).toBe(out));
});
