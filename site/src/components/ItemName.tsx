import { type ReactNode, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { iconUrl } from "../../../src/shared/types.ts";
import { qualityColor } from "../lib/format.ts";
import { StarButton } from "./StarButton.tsx";

export interface ItemLike {
  id: number;
  name: string;
  quality: string | null;
  icon?: number | null;
  tip?: string[];
}

interface Props {
  item: ItemLike;
  /** Link text instead of the name (e.g. "Details" next to a picker). */
  label?: ReactNode;
  /** "row" in tables, "title" for card titles. */
  size?: "row" | "title";
  block?: boolean;
  /** Leave out the star (e.g. a "Details" link next to a picker). */
  noStar?: boolean;
}

const TIP_WIDTH = 300;

const LINK = {
  row: "items-center gap-2 font-semibold no-underline hover:underline",
  title: "items-center gap-2 text-[19px] font-bold no-underline hover:underline",
} as const;
const ICON = {
  row: "size-[18px] flex-none rounded border border-line-strong",
  title: "size-6 flex-none rounded border border-line-strong",
} as const;

/** Tooltip text lines from items.json; "Use:" lines in the game's green. */
export function TipLines({ lines }: { lines: string[] }) {
  return lines.map((line) => (
    <p key={line} className={`mt-1 whitespace-pre-line${line.startsWith("Use:") ? " text-use" : ""}`}>
      {line}
    </p>
  ));
}

/** Item icon + name linking to its page, with a game-style tooltip on hover or keyboard focus. */
export function ItemName({ item, label, size = "row", block, noStar }: Props) {
  const tipId = useId();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  // Fixed-position, in a portal: table wrappers scroll horizontally and would clip an absolutely positioned box.
  const show = (el: HTMLElement) => {
    // Nothing beyond the name to show (data from before icons, or an item the API has no art or text for).
    if (!item.icon && !item.tip?.length) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(8, Math.min(r.left, window.innerWidth - TIP_WIDTH - 8));
    setAt({ x, y: r.bottom + 6 });
  };
  const hide = () => setAt(null);

  return (
    <span className={`${block ? "flex" : "inline-flex"} items-center gap-1.5`}>
      {noStar ? null : <StarButton id={item.id} name={item.name} />}
      <Link
        to={`/item/${item.id}`}
        className={`inline-flex ${LINK[size]}`}
        style={{ color: qualityColor(item.quality) }}
        aria-describedby={at ? tipId : undefined}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={hide}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={hide}
      >
        {item.icon ? (
          <img className={ICON[size]} src={iconUrl(item.icon, 36)} alt="" width={18} height={18} loading="lazy" />
        ) : null}
        <span>{label ?? item.name}</span>
      </Link>
      {at
        ? createPortal(
            <div
              id={tipId}
              role="tooltip"
              className="pointer-events-none fixed z-50 max-w-[calc(100vw-16px)] rounded-ctl border border-line-strong bg-tip px-3 py-2.5 text-[13px] leading-[1.45] text-soft shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
              style={{ left: at.x, top: at.y, width: TIP_WIDTH }}
            >
              <div className="mb-1.5 flex items-center gap-2.5">
                {item.icon ? (
                  <img
                    className="rounded-md border border-line-strong"
                    src={iconUrl(item.icon, 56)}
                    alt=""
                    width={36}
                    height={36}
                  />
                ) : null}
                <strong style={{ color: qualityColor(item.quality) }}>{item.name}</strong>
              </div>
              <TipLines lines={item.tip ?? []} />
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
