# domain/contract — conventions

- Types and constants only; depends on `@hmpt/kernel` alone. Compiles without the DOM.
- Ports speak domain vocabulary (`createIfAbsent`, not `put`). Expected failures are `Result`
  errors with a closed string union — the UI maps each to a message.
- Changing a port is changing every adapter: update `infra/*`, the fakes in
  `domain/core/src/testing`, and the wiring in `application/pwa`.
