# application/pwa — conventions

- The only package allowed to import `@hmpt/domain-core`. Wiring is explicit construction —
  no container, no module-scope singletons.
- In `main.ts`: build infra, then the domain, then `provideContexts`, then define elements
  (definitions upgrade parsed markup synchronously, so the provider must already listen).
- `sw.ts` compiles against WebWorker (`tsconfig.sw.json`) and imports only what runs there.
- Templates and pages live in `index.html`; elements never know where they are mounted.
- The walkthrough's tour stops are declared here, in `index.html`: give an element
  `data-tour="<order>"`, `data-tour-title` and `data-tour-text`. Keep the copy in the
  librarian's voice, and update the e2e test that walks the tour when stops change.
- `createBrowserInstaller()` runs first thing in `main.ts`, before any `await`.
