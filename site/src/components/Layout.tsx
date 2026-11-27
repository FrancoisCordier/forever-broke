import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { HOUSE, useBuyList } from "../lib/data.ts";
import { countdown, timeAgo } from "../lib/format.ts";

const PAGE_WIDTH = "mx-auto max-w-[1200px] px-4 sm:px-6";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2.5 no-underline ${isActive ? "bg-raised font-semibold text-fg" : "text-muted"}`;

const CHIP = {
  plain: "rounded-full bg-chip px-2.5 py-1.5 text-soft",
  warn: "rounded-full bg-warn-bg px-2.5 py-1.5 text-loss",
  raid: "rounded-full bg-raid-bg px-2.5 py-1.5 font-semibold text-raid",
} as const;

function Logo() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#f2c75c"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5c0-1.2 1.3-2 3-2s3 .8 3 2-1.3 1.8-3 2.3-3 1.1-3 2.4 1.3 2.3 3 2.3 3-.9 3-2" />
    </svg>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const list = useBuyList();
  const data = list.state === "ok" ? list.data : null;
  const left = data ? countdown(data.raidOpens) : null;
  const stale = data ? Date.now() / 1000 - data.t > 3 * 3600 : false;

  return (
    <div>
      <header className="border-b border-line bg-bar">
        <div className={`${PAGE_WIDTH} flex flex-wrap items-center gap-x-6 gap-y-3 py-3`}>
          <NavLink to="/" className="flex items-center gap-2.5 text-lg font-bold text-fg no-underline">
            <Logo />
            <span>Forever Broke</span>
          </NavLink>
          <nav aria-label="Main" className="flex flex-wrap gap-1">
            <NavLink to="/" end className={navClass}>
              Deals
            </NavLink>
            <NavLink to="/kit" className={navClass}>
              My kit
            </NavLink>
            <NavLink to="/stockpile" className={navClass}>
              Stockpile
            </NavLink>
            <NavLink to="/raid" className={navClass}>
              Raid prep
            </NavLink>
          </nav>
          <div className="flex-auto" />
          <div className="flex flex-wrap gap-2 text-[13px]">
            <span className={CHIP.plain}>House {HOUSE} · Alliance</span>
            {data ? (
              <span className={stale ? CHIP.warn : CHIP.plain} title="Time of the auction house snapshot">
                Data {timeAgo(data.t)}
              </span>
            ) : null}
            {left ? <span className={CHIP.raid}>Raids open in {left}</span> : null}
          </div>
        </div>
      </header>
      <main className={`${PAGE_WIDTH} pt-8 pb-16`}>{children}</main>
    </div>
  );
}
