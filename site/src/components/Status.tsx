import type { Loadable } from "../lib/data.ts";

/** Loading / error placeholder for a Loadable that isn't "ok". */
export function Status({ value }: { value: Loadable<unknown> }) {
  if (value.state === "loading") return <p className="text-muted">Loading…</p>;
  if (value.state === "error")
    return (
      <p className="text-loss" role="alert">
        Couldn't load data ({value.error}). The collector may not have run yet. Try again in a few minutes.
      </p>
    );
  return null;
}
