# ADR 0002 — Daily reminders without a server

- **Status:** accepted · 2026-11-24

## Context

The reader wants a notification at a fixed hour every day. The app is a static site on
GitHub Pages: no backend, no push server. The web platform's options:

| Mechanism | Background? | Exact time? | Availability |
|---|---|---|---|
| Web Push | yes | yes | needs a push server — ruled out |
| Notification Triggers | yes | yes | abandoned origin trial — gone |
| Periodic Background Sync | yes | no (browser picks cadence) | Chromium, installed PWA |
| Page timer | no | yes | anywhere, while open |
| Calendar event (.ics) with alarm | yes | yes | everywhere, via the phone's calendar |

## Decision

Layer the three serverless mechanisms behind one domain policy:

- The domain owns *when* a reminder is due (`ReminderCheckPort.run`: after the chosen time,
  at most once a day, only while today's card is unread). Both wake-up sources — the
  service worker on `periodicsync`, the page's own timer — call that same port, and the
  IndexedDB state (`lastNotifiedOn`) keeps them from double-notifying.
- `ReminderScheduler` (infra) registers Periodic Background Sync where it exists and
  reports the delivery honestly (`background` vs `while-open`); the UI says which applies.
- The reminder form offers a generated `.ics` daily event with an alarm as the reliable
  fallback on every platform.

## Consequences

- Android (installed): a background reminder near the chosen hour. iOS: exact while open,
  calendar otherwise. Copy in the form states this plainly.
- Adding Web Push later is a new `Notifier`/`ReminderScheduler` adapter plus a server; the
  domain policy and the elements do not change.
