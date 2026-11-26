import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { HOUSE, useBuyList } from "../lib/data.ts";
import { countdown, timeAgo } from "../lib/format.ts";

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
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <Logo />
            <span>Forever Broke</span>
          </NavLink>
          <nav aria-label="Main" className="nav">
            <NavLink to="/" end>
              Buy list
            </NavLink>
            <NavLink to="/kit">My kit</NavLink>
            <NavLink to="/stockpile">Stockpile</NavLink>
            <NavLink to="/raid">Raid prep</NavLink>
          </nav>
          <div className="spacer" />
          <div className="chips">
            <span className="chip">House {HOUSE} · Alliance</span>
            {data ? (
              <span className={`chip${stale ? " chip-warn" : ""}`} title="Time of the auction house snapshot">
                Data {timeAgo(data.t)}
              </span>
            ) : null}
            {left ? <span className="chip chip-raid">Raids open in {left}</span> : null}
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
