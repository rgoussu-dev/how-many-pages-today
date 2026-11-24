# user-side/elements — conventions

- Extend `PortBoundElement`: `markup()` (static HTML), `setup()` (DOM listeners, once),
  `connect()` (request ports, subscribe; return cleanups).
- Depend on `domain/contract`, `kernel/context`, the design system and planks — never on
  the core or infra.
- Render by patching the nodes you own; user text via `textContent` only.
- Forms keep what the reader is typing: skip re-renders while dirty.
- Charts follow the dataviz rules: one validated colour per theme (re-run the palette
  validator if you change `--chart-bar`), bars ≤ 24px with a 2px gap, hairline solid
  gridlines, a tooltip on hover *and* focus, and a table view holding every value.
