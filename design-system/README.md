# @hmpt/design-system

Domain-blind presentation for an old library on an autumn afternoon.

- `theme.css` — parchment, leather, gilt and wood; lamplight; buttons,
  ruled-paper fields, the meter; a lamplit evening variant for dark mode. Layered on planks tokens.
- `fonts.css` — EB Garamond (text) and IM Fell English / SC (display), latin subsets,
  bundled and precached (SIL Open Font License).
- `<hmpt-ds-scene seed="…" [lang="fr"]>` — the card plate: one of six cosy scenes (shelves,
  lamp, nook, armchair, window, still life) painted as SVG from a seed, described (its
  aria-label) in English or French; `renderScene(seed, kind?, lang?)` is pure.
- `<hmpt-ds-bookmark seed="…" mark="p. 112" [side="right"]>` — a bookmark: a slim card
  painted with an autumn forest in red, orange and gold (at dusk, in a golden mist, or
  under a harvest moon — the seed picks), a gilt frame and
  swallowtail, `mark` on a parchment label, a silk cord and tassel spilling out to its
  left. Size it with `--bookmark-width`; `side="right"` mirrors the tassel for a book lying
  on its back. Give it any height and it runs that long (it measures itself): more sky,
  deeper woods, taller trees — never stretched. `renderBookmark(seed, length?)` is pure.
