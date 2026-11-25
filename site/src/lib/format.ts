export { formatGold } from "../../../src/shared/gold.ts";

/** −0.214 → "−21%", 0.05 → "+5%", 0 → "±0%". */
export function formatPct(x: number | null): string {
  if (x === null || !Number.isFinite(x)) return "—";
  const n = Math.round(x * 100);
  if (n === 0) return "±0%";
  return `${n > 0 ? "+" : "−"}${Math.abs(n)}%`;
}

/** Whole gold for totals: 1794800 → "179g". */
export function formatWholeGold(copper: number): string {
  return `${Math.round(copper / 10000).toLocaleString("en-GB")}g`;
}

/** "23 min ago", "3 h ago", "2 days ago". */
export function timeAgo(t: number, now = Date.now() / 1000): string {
  const s = Math.max(0, now - t);
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

/** Countdown to an ISO date: "6d 15h", "4h 10m", or null once passed. */
export function countdown(iso: string, now = Date.now()): string | null {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

export const shortDate = (t: number) =>
  new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export const dateTime = (t: number) =>
  new Date(t * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

const QUALITY_COLORS: Record<string, string> = {
  POOR: "#9d9d9d",
  COMMON: "#e8eaef",
  UNCOMMON: "#4fd165",
  RARE: "#5aa9ff",
  EPIC: "#b67bff",
  LEGENDARY: "#ff9b3d",
};
export const qualityColor = (q: string | null) => QUALITY_COLORS[q ?? ""] ?? QUALITY_COLORS.COMMON;
