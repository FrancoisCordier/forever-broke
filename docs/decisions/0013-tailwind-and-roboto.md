# ADR-0013: Styling with Tailwind CSS, Roboto as the font

Status: **Accepted** (2026-11-27)

## Context

The site (ADR-0008) was styled with one hand-written stylesheet (~830 lines of class rules) in Inter, with
Space Grotesk for headings. The owner asked for Tailwind and Roboto.

## Decision

- **Tailwind CSS v4** through `@tailwindcss/vite`. `site/src/styles.css` holds only the theme (the dark palette
  from docs/ui.md as `@theme` tokens: `bg-surface`, `text-gold`, `rounded-card`…) and a small base layer for
  element defaults (body, headings, links, focus ring). Everything else is utilities in the markup.
- Patterns used on several pages (cards, tables, buttons, form fields, tags) are full class strings in
  `site/src/lib/ui.ts`. No `@apply` component classes, and no class names built from variables (Tailwind
  only generates classes it finds written out in the source).
- **Roboto** (400–700) from Google Fonts for all text, headings included.
- Biome parses Tailwind directives (`css.parser.tailwindDirectives`).

## Consequences

- Same look as before, apart from the font. Chart colours in Recharts and SVG stay as hex values: they're
  attributes, not CSS.
- A variant must not repeat a property its base sets (two `bg-*` on one element don't override by order).
  `ui.ts` keeps base and variant properties disjoint.
