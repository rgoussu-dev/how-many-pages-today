# infra/reminders-browser — conventions

- `./notifier` must compile under both DOM and WebWorker libs: touch only
  `ServiceWorkerRegistration`. Page-only APIs (`Notification`, `navigator.permissions`) stay
  in `scheduler.ts`.
- Feature-detect, never assume: Periodic Background Sync is Chromium-only.
