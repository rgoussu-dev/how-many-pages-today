# @hmpt/infra-storage-indexeddb

`openReadingDatabase()` returns adapters for every repository port over one IndexedDB
database (`challenges`, `settings`, `achievements`). IndexedDB — not localStorage — because
the service worker reads the same state to decide on reminders.
