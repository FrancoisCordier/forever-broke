// Tailwind class lists shared by several components (ADR-0013).
// Keep every class a complete literal: Tailwind finds classes by scanning the source, so `bg-${x}` would never be generated.
// Variants never repeat a property of their base (colour, weight…): two utilities for one property don't override by order.

/** Text styles for numbers and notes. */
export const gold = "font-semibold text-gold";
export const cheap = "font-bold text-accent";
export const loss = "font-bold text-loss";
export const small = "text-[13.5px]";
/** Secondary text in a table cell or under a name; wraps even in a no-wrap cell.
 *  `!`: the table's `[&_td]:whitespace-nowrap` compiles to `.x td`, which outranks a single class. */
export const note = "max-w-80 whitespace-normal! text-[13.5px] text-muted";
/** A short line under an item name in a table cell (slot, purchase date). */
export const subline = "block whitespace-nowrap text-[12.5px] text-muted";

/** Page structure. */
export const pageHead = "flex flex-wrap items-end justify-between gap-x-8 gap-y-5";
export const headControls = "flex flex-wrap items-end gap-3";
export const sectionHead = "flex flex-wrap items-center gap-x-3.5 gap-y-2";
export const lead = "max-w-160 text-muted";
export const pageFoot = "flex flex-col gap-1.5 border-t border-line pt-5 text-[13.5px] text-muted [&_strong]:text-soft";
export const empty = "rounded-card border border-dashed border-line-strong bg-surface p-5 text-muted";
export const notice = "rounded-ctl bg-raid-bg px-3.5 py-3 text-raid";

export const card = "rounded-card border border-line bg-surface p-[18px]";
export const cardGrid = "grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-4";
/** Title row of a buy/resell card: name and tags on the left, copy button on the right. */
export const cardHead = "flex items-start justify-between gap-3";
/** Three numbers side by side (Now / Normal / vs normal). */
export const stats3 =
  "grid flex-auto grid-cols-3 gap-4 [&_dd]:mt-0.5 [&_dd]:text-[17px] [&_dd]:font-bold [&_dt]:text-xs [&_dt]:text-muted";

/** Tables: a scrolling frame and the table itself. Cells don't wrap unless they hold a `note`. */
export const tableWrap = "relative overflow-x-auto rounded-card border border-line bg-surface";
const cells =
  "w-full border-collapse [&_td]:border-b [&_td]:border-line-soft [&_td]:px-3.5 [&_td]:py-2 [&_td]:align-middle [&_td]:whitespace-nowrap [&_th]:border-b [&_th]:border-line [&_th]:px-3.5 [&_th]:py-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-muted [&_tbody_tr:last-child_td]:border-b-0";
export const table = `min-w-[720px] ${cells}`;
/** A table narrow enough not to need a minimum width. */
export const tableNarrow = cells;

/** Buttons (and links styled as buttons). */
const BTN =
  "inline-flex flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-ctl border no-underline";
const BTN_VARIANT = {
  primary: "border-accent bg-accent font-bold text-accent-ink hover:bg-accent-light",
  secondary: "border-line-strong bg-chip font-bold text-fg hover:bg-raised",
  ghost: "border-line-strong bg-transparent font-medium text-soft",
} as const;
export type BtnVariant = keyof typeof BTN_VARIANT;
export const btn = (variant: BtnVariant, isSmall = false) =>
  `${BTN} ${BTN_VARIANT[variant]} ${isSmall ? "h-9 px-2.5 text-[13px]" : "h-11 px-3.5"}`;

/** One button of a segmented control (`aria-pressed` marks the chosen one). */
export const segment =
  "h-9 cursor-pointer rounded-lg border border-line-strong px-2.5 text-[13px] text-muted aria-pressed:bg-raised aria-pressed:font-semibold aria-pressed:text-fg";

/** Form fields: label above control. */
export const field = "flex flex-col gap-1";
export const label = "text-xs font-medium text-muted";
export const numberInput = "h-11 w-[110px] rounded-ctl border border-line-strong bg-bar px-3 font-semibold text-gold";
export const textInput = "h-11 w-60 max-w-full rounded-ctl border border-line-strong bg-bar px-3 font-medium text-fg";
export const select = "h-11 rounded-ctl border border-line-strong bg-bar px-2.5 text-fg";
/** Smaller controls inside table cells. */
export const cellInput = "h-9 w-[72px] rounded-lg border border-line-strong bg-bar px-2 text-fg";
export const cellSelect = "mb-1 h-9 max-w-60 rounded-lg border border-line-strong bg-bar px-2 text-fg";

/** Small labels on cards and rows. */
export const tags = "flex flex-wrap gap-1.5 text-[12.5px]";
const TAG = "rounded-md px-2 py-[3px]";
export const tag = {
  plain: `${TAG} bg-raised text-soft`,
  raid: `${TAG} bg-raid-bg font-semibold text-raid`,
  cheap: `${TAG} bg-accent/14 font-bold text-accent`,
  sell: `${TAG} bg-mint/16 font-bold text-sell`,
  flip: `${TAG} bg-gold/14 font-bold text-gold`,
} as const;
export type TagKind = keyof typeof tag;
