# ADR-0008: Website stack: Vite + React + TypeScript on GitHub Pages

Status: **Accepted** (2026-11-25)

## Context

The site is static: it reads JSON produced by the collector, and keeps personal data (budget, later the
stockpile) in `localStorage`. The owner knows React through Next.js. Options were Next.js (static
export), Vite + Preact, or Vite + React.

## Decision

- **Vite + React 19 + TypeScript**, source in `site/`. Same React the owner knows, without Next's
  server features, which a static site can't use anyway.
- **React Router in hash mode** (`/#/item/248822`): GitHub Pages can't serve deep links for a single-page app.
- **Recharts** for the item chart, loaded lazily with the item page. Sparklines are plain inline SVG.
- **Data is read live** from the `data` branch through `raw.githubusercontent.com`. It allows cross-origin
  requests and caches for ~5 min (checked 2026-11-25). The site build doesn't include data, so the
  site only redeploys when its code changes (`.github/workflows/pages.yml`).
- The site imports `src/shared/` (gold formatting, signal types) directly, so it can't drift from the collector.
- App name: **Forever Broke**.

## Consequences

- The site lives at `https://francoiscordier.github.io/forever-broke/`.
- Preact was rejected: its smaller bundle doesn't matter for a personal site.
- If raw.githubusercontent.com caching ever gets in the way, the fallback is to copy the data into the Pages deploy on each collector run.
