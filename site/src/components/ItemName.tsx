import { type ReactNode, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { iconUrl } from "../../../src/shared/types.ts";
import { qualityColor } from "../lib/format.ts";

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
  /** "item-link" in tables, "item-name" for card titles. */
  className?: string;
  block?: boolean;
}

const TIP_WIDTH = 300;

/** Item icon + name linking to its page, with a game-style tooltip on hover or keyboard focus. */
export function ItemName({ item, label, className = "item-link", block }: Props) {
  const tipId = useId();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  // Fixed-position, in a portal: table wrappers scroll horizontally and would clip an absolutely positioned box.
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const x = Math.max(8, Math.min(r.left, window.innerWidth - TIP_WIDTH - 8));
    setAt({ x, y: r.bottom + 6 });
  };
  const hide = () => setAt(null);

  return (
    <>
      <Link
        to={`/item/${item.id}`}
        className={`${className} item-with-icon`}
        style={{ color: qualityColor(item.quality), display: block ? "flex" : undefined }}
        aria-describedby={at ? tipId : undefined}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={hide}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={hide}
      >
        {item.icon ? (
          <img className="item-icon" src={iconUrl(item.icon, 36)} alt="" width={18} height={18} loading="lazy" />
        ) : null}
        <span>{label ?? item.name}</span>
      </Link>
      {at
        ? createPortal(
            <div id={tipId} role="tooltip" className="item-tip" style={{ left: at.x, top: at.y, width: TIP_WIDTH }}>
              <div className="item-tip-head">
                {item.icon ? <img src={iconUrl(item.icon, 56)} alt="" width={36} height={36} /> : null}
                <strong style={{ color: qualityColor(item.quality) }}>{item.name}</strong>
              </div>
              {(item.tip ?? []).map((line) => (
                <p key={line} className={line.startsWith("Use:") ? "item-tip-use" : undefined}>
                  {line}
                </p>
              ))}
              {item.tip === undefined || item.tip.length === 0 ? (
                <p className="muted">No tooltip text recorded for this item yet.</p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
