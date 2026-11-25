# ADR-0005: Public GitHub repository

Status: **Accepted** (2026-11-25)

## Context

- GitHub Actions minutes are unlimited for public repos. Private repos on the free plan get 2,000 min/month.
  An hourly job of ~1–2 min uses 720–1,440 min/month, which is uncomfortably close to the limit.
- GitHub Pages from a private repo needs a paid plan.
- A public repo exposes: the code, the AH aggregates (public data anyway), and the watchlist,
  which hints at what you're stockpiling. Secrets stay private in Actions secrets either way.
  The stockpile itself is in localStorage, never in the repo.
- Scheduled workflows in public repos are disabled after 60 days without repo activity (exact trigger to verify).

## Decision

Public repo. The data is public anyway, and it's the only setup that is free and has comfortable headroom.

## Consequences

- Anyone can see the watchlist. If that matters, keep a minimal public watchlist and "collect broadly" (ADR-0004) covers the rest.
- Keep the 60-day inactivity rule in mind after January.
