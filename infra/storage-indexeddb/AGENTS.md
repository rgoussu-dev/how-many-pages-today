# infra/storage-indexeddb — conventions

- Compiles against the WebWorker lib: must run in the page and the service worker.
- Schema changes bump `VERSION` and migrate in `onupgradeneeded` — readers' history must
  survive every release.
- Integration-tested against `fake-indexeddb`, including the page-vs-worker race.
