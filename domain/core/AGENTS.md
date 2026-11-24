# domain/core — conventions

- No DOM, no browser globals — time comes from `Clock`, randomness from `RandomSource`.
- Day keys are local calendar days (`YYYY-MM-DD`); calendar maths goes through `days.ts`
  (UTC arithmetic, so DST never skips a day).
- Every rule gets a unit test in a sibling `*.test.ts` against `./testing` fakes.
- Only `src/index.ts` and `src/testing/index.ts` are public; keep everything else internal.
