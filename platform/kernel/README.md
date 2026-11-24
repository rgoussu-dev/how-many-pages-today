# @hmpt/kernel

The shared kernel. `.` — `Result`/`ok`/`err` and the ubiquitous `Clock` and `RandomSource`
port types (no DOM). `./context` — the Web Components Community Group Context protocol
(`createContext`, `ContextRequestEvent`, `provideContexts`), kept apart because it needs DOM `Event`.
