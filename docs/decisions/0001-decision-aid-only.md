# ADR-0001: Decision aid only, no automation

Status: **Accepted** (from brief)

## Context

Blizzard's ToS forbids botting, memory reading and input automation. The project's value is information, not execution.

## Decision

Nothing in this project buys, posts, or simulates input. Data comes only from the official Game Data API.
The addon (if built) uses only permitted UI APIs and never triggers an AH action without the player's own click.

## Consequences

- No auto-buy feature requests, ever. A "buy list" is fine; acting on it is the player's job.
