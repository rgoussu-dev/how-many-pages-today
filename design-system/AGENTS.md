# design-system — conventions

- Never imports a domain, an adapter or the shell. Attributes in, `CustomEvent`s out.
- Tags are `hmpt-ds-*`. Light DOM, styles tag-scoped, like planks.
- Scenes must stay self-contained (no external URLs) and deterministic per seed — a day's
  card must look the same forever. Changing a painter changes past cards; do so knowingly.
