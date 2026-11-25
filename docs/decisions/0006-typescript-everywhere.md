# ADR-0006: TypeScript for the collector (instead of Python)

Status: **Accepted** (2026-11-25, supersedes the brief's "Python 3.12 collector")

## Context

The brief specifies a Python collector. The owner works in TypeScript, not Python. The site is TypeScript
anyway. The collector's work is small: about 15 HTTP requests/hour, parsing ~10–50 MB of JSON, percentiles, and writing files.
Nothing in it needs Python's data libraries.

## Decision

One language: **TypeScript on Node 22 LTS+**, in one repo with shared code:

```
src/shared/     # types, aggregation, signals, gold formatting (pure, no I/O)
src/collector/  # API client, run loop, file writer (Node only)
site/           # Vite + Preact app, imports src/shared
tools/          # update_addon.ts (phase 4)
```

- Run the collector `.ts` directly (Node type stripping or `tsx`), no build step.
- Built-in `fetch`; YAML via the `yaml` package; tests with Vitest.
- Package manager: **pnpm**. Node 24 runs `.ts` natively (type stripping), so code must use erasable syntax only (no `enum`, no parameter properties).

## Consequences

- Signal logic and types are shared between the collector and the site, so they can't drift apart.
- The owner can maintain and debug the most critical component.
- Process houses one at a time to bound memory (large JSON payloads).
