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
