import { toggleStar, useStars } from "../lib/stars.ts";

/** ☆ / ★ in front of an item name: follow the item across every list (ADR-0014). */
export function StarButton({ id, name }: { id: number; name: string }) {
  const on = useStars().has(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Unstar ${name}` : `Star ${name}`}
      title={on ? "Starred: click to unstar" : "Star to follow it in every list"}
      className="-m-1 flex-none cursor-pointer rounded border-0 bg-transparent p-1 text-[15px] leading-none text-muted hover:text-gold aria-pressed:text-gold"
      onClick={() => toggleStar(id)}
    >
      {on ? "★" : "☆"}
    </button>
  );
}
