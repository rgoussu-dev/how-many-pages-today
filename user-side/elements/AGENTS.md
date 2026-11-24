# user-side/elements — conventions

- Extend `PortBoundElement`: `markup()` (static HTML), `setup()` (DOM listeners, once),
  `connect()` (request ports, subscribe; return cleanups).
- Depend on `domain/contract`, `kernel/context`, the design system and planks — never on
  the core or infra.
- Render by patching the nodes you own; user text via `textContent` only.
- No English in an element. Static words in `markup()` are marked, not written:
  `data-t="section.key"` (text), `data-t-placeholder`, `data-t-label` (aria-label),
  `data-t-title`; call `this.speak(snapshot.language)` at the top of every render — it
  localizes them when the language changes and returns the `Speech` (`t` for words, plus
  dates and numbers in the reader's locale). Words that depend on data come from `t`
  functions. Add every key to `en.ts` and `fr.ts`; a missing path logs `No phrase at …`,
  which fails the e2e suite.
- Never format with `toLocaleString()` or `Intl` defaults — use the `Speech` helpers, which
  follow the reader's language, not the browser's.
- Forms keep what the reader is typing: skip re-renders while dirty.
- Charts follow the dataviz rules: one validated colour per theme (re-run the palette
  validator if you change `--chart-bar`), bars ≤ 24px with a 2px gap, hairline solid
  gridlines, a tooltip on hover *and* focus, and a table view holding every value.
