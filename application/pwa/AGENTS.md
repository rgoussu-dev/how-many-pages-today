# application/pwa — conventions

- The only package allowed to import `@hmpt/domain-core`. Wiring is explicit construction —
  no container, no module-scope singletons.
- In `main.ts`: build infra, then the domain, then `provideContexts`, then define elements
  (definitions upgrade parsed markup synchronously, so the provider must already listen).
- `sw.ts` compiles against WebWorker (`tsconfig.sw.json`) and imports only what runs there.
- Templates and pages live in `index.html`; elements never know where they are mounted.
- The walkthrough's tour stops are declared here, in `index.html`: give an element
  `data-tour="<order>"` and `data-tour-stop="<stop>"`, and word the stop under `tour.<stop>`
  in both phrasebooks. Keep the copy in the librarian's voice, and update the e2e test that
  walks the tour when stops change.
- The shell's own words in `index.html` are marked `data-t…` like the elements'; the English
  written there is only what shows before the app boots.
- `createBrowserInstaller()` runs first thing in `main.ts`, before any `await`.
- A staging copy shares production's origin. Anything that persists on the device (a new
  database, cache or storage key) must be named through `src/stage.ts`, so staging never
  touches the real reader's data; production's `sw.ts` must never serve navigations under
  `staging/`.
- A new service worker waits (no `skipWaiting` on install): it takes over only when the page
  asks (`{ type: 'skip-waiting' }`, sent by "Open it"), and the page reloads on the
  `controllerchange` it asked for — never on the first install's. Keep it that way: an app
  swapped mid-use may load assets the old page never knew.
- `e2e/updates.spec.ts` ships a new version by editing `dist/sw.js` mid-test, so it runs in its
  own Playwright project after all the others (`dependencies`); keep other tests out of it.
