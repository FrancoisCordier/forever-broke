/**
 * What a player types for a price → copper. Accepts "11g 55s", "11g55s20c", "55s", "80c", and plain gold
 * as a number ("11.55" = 11g 55s, "3" = 3g). Returns null for anything else, or a negative amount.
 */
export function parseGold(input: string): number | null {
  const s = input.trim().toLowerCase().replace(",", ".");
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 10000);
  const m = /^(?:(\d+)\s*g)?\s*(?:(\d+)\s*s)?\s*(?:(\d+)\s*c)?$/.exec(s);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 10000 + Number(m[2] ?? 0) * 100 + Number(m[3] ?? 0);
}

/** 123456 → "12g 34s 56c". Leading zero units are dropped ("34s 56c"), except a bare 0 → "0c". */
export function formatGold(copper: number): string {
  const sign = copper < 0 ? "-" : "";
  const c = Math.abs(Math.round(copper));
  const g = Math.floor(c / 10000);
  const s = Math.floor((c % 10000) / 100);
  const r = c % 100;
  const parts: string[] = [];
  if (g) parts.push(`${g}g`);
  if (g || s) parts.push(`${s}s`);
  parts.push(`${r}c`);
  return sign + parts.join(" ");
}
