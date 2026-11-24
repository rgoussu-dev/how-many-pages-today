# @hmpt/elements

The driving adapters: port-bound custom elements — `hmpt-today-card`, `hmpt-greeting`,
`hmpt-streak-summary`, `hmpt-history-calendar`, `hmpt-achievement-list`, `hmpt-bookshelf`, `hmpt-reading-overview`, `hmpt-profile-form`,
`hmpt-language-form`, `hmpt-range-form`, `hmpt-reminder-form`, `hmpt-celebration`, `hmpt-welcome` (the first-visit walkthrough), `hmpt-welcome-replay` — plus `readingContexts`, the typed
context keys they request, and `defineReadingElements()`.

`src/i18n/` holds the phrasebooks — `en.ts` (the reference; its type is `Messages`) and
`fr.ts` — and `speech()`, which pairs one with the locale's dates and numbers. The shell
uses `localize()` and `speech()` for its own words.
