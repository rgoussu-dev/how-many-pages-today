import { defineConfig } from 'vitest/config';

// One project per test strategy (see AGENTS.md → Testing):
// - the domain runs in plain Node — no DOM anywhere in sight;
// - the IndexedDB adapter is integration-tested against an in-process IndexedDB;
// - the design system's scene generator is pure and runs in Node too.
// Elements are exercised in a real browser by the Playwright suite in application/pwa/e2e.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'domain',
          environment: 'node',
          include: ['domain/**/*.test.ts', 'platform/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'infra',
          environment: 'node',
          include: ['infra/**/*.test.ts'],
          setupFiles: ['fake-indexeddb/auto'],
        },
      },
      {
        test: {
          name: 'design-system',
          environment: 'node',
          include: ['design-system/**/*.test.ts'],
        },
      },
    ],
  },
});
