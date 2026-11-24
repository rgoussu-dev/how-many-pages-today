# platform/kernel — conventions

- Depends on nothing. `src/index.ts` must compile under `ES2022` alone; anything needing the
  DOM goes in a separate entry point (like `./context`) with its own tsconfig.
- Only add what every layer genuinely shares. Domain vocabulary belongs in `domain/contract`.
