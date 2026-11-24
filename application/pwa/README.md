# @hmpt/pwa

The deployment unit. `index.html` composes the pages from planks primitives and the
module's elements; `src/main.ts` is the assembly point; `src/router.ts` the hash router;
`src/localize-shell.ts` puts the shell's own words, `<html lang>` and the title into the
reader's language;
`src/keep-fresh.ts` deals the new card at midnight and runs the reminder check while open;
`src/sw.ts` precaches the build and runs the reminder check on periodic sync;
`src/stage.ts` tells a staging build (`VITE_STAGE=staging`) apart from production.

`npm run dev`, `npm run build`, `npm run preview`, `npm run e2e`, `npm run icons`.

A staging build — `BASE_PATH=/how-many-pages-today/staging/ VITE_STAGE=staging npm run build` —
installs as "How Many Pages Today (staging)", keeps its own IndexedDB database
(`how-many-pages-today-staging`) and its own service worker scope, and wears a "Staging" tag.
