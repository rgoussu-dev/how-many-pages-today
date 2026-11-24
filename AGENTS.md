# How Many Pages Today — agent guide

An offline-first PWA (daily reading challenge), built on the house frontend hexagonal
reference, `basic` layout, with `@rgoussu.dev/planks` for layout. Read `README.md` first.

## Ground rules

- **Dependencies point inward.** `domain/contract` ← `domain/core`; adapters
  (`user-side/*`, `infra/*`) depend on the contract only; `application/pwa` alone wires
  `domain/core`. `npm run lint:arch` is the wall — run it, and never weaken a rule to
  make a change pass.
- **The domain has no DOM.** `domain/*` and `platform/kernel` (`.`) compile against
  `ES2022` only. Browser APIs belong behind a driven port in `infra/`.
- **New capability = port first.** Declare the port in `domain/contract` in domain
  vocabulary, implement it in `infra/<technology>/`, wire it in `application/pwa/src/main.ts`
  (and `sw.ts` if the service worker needs it).
- **Elements get ports through the Context protocol** (`readingContexts` +
  `PortBoundElement.request`). Never import a port implementation into an element.
  Elements are light DOM (planks is light DOM — see `docs/adr/0001`), tags prefixed `hmpt-`,
  design-system tags `hmpt-ds-`.
- **Everything stays on the device.** No network calls, no analytics, no external fonts
  or images (fonts are bundled). The service worker precaches the whole build.
- **The look is an old library on an autumn afternoon** (dark mode: the same room by
  lamplight). Parchment for pages, leather and gilt for what matters, wood for the shelf.
  Keep new UI in that vocabulary.
- **Escape by construction.** User text reaches the DOM through `textContent` only.

## Testing

| Layer | How |
|---|---|
| `domain/core` | Vitest in Node against the domain's own fakes (`@hmpt/domain-core/testing`) |
| `infra/storage-indexeddb` | Vitest against `fake-indexeddb` |
| `design-system` scene | Vitest in Node (pure string output) |
| elements + shell + service worker | Playwright on the production build (`npm run e2e`) |

No contract tests between infra and the domain contract (house rule).

## Commands

`npm run verify` (typecheck, lint:arch, test, build) must pass before every commit;
`npm run e2e` before pushing (set `PLAYWRIGHT_CHROMIUM_PATH` to reuse an installed Chromium).
dependency-cruiser's `missing-tsc-transpiler` warning is expected under TypeScript 7.0 — it
parses with SWC; switch back to the tsc parser once TypeScript 7.1 ships. After editing `application/pwa/public/icons/favicon.svg`,
run `npm run icons -w @hmpt/pwa` and commit the PNGs.

Every package carries a `README.md` (what it is) and an `AGENTS.md` (local conventions).
