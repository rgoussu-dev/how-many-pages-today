# ADR 0001 — Light-DOM elements, layout by planks

- **Status:** accepted · 2026-11-24

## Context

The house frontend reference builds elements on Shadow DOM so styles are walled. This app
takes its layout from `@rgoussu.dev/planks`, whose primitives are light-DOM by design: their
structural CSS is a tag-scoped stylesheet injected once into `document.head`. A shadow root
would wall that sheet out, forcing every element to re-adopt planks' structural CSS (and the
theme) into its own root.

## Decision

Port-bound elements and design-system elements render in the **light DOM**, with tag-scoped
styles (`hmpt-today-card .today-number { … }`) — the planks convention applied to ours. The
Context protocol, port-bound wiring and the domain boundaries are unchanged.

## Consequences

- Planks primitives, theme tokens and resets cascade into every element with no plumbing.
- Style isolation is by convention (tag-scoped selectors, `hmpt-` prefixes), not by the
  platform. A shadow root remains available to any future element that needs real isolation.
