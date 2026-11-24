import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const base = '/how-many-pages-today/';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}${base}`,
    trace: 'off',
    serviceWorkers: 'allow',
    // The daily flourish keeps the card closed for ~3s; most tests don't need to watch it.
    // Reduced motion opens it at once. The flourish has its own test with motion on.
    contextOptions: { reducedMotion: 'reduce' },
    // CI installs the Chromium this Playwright version expects. Elsewhere, point
    // PLAYWRIGHT_CHROMIUM_PATH at an existing Chromium to skip the download.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, testIgnore: /updates\.spec\.ts/ },
    // Ships a new service worker into the build mid-test: it runs alone, after the rest.
    {
      name: 'updates',
      use: { ...devices['Pixel 7'] },
      testMatch: /updates\.spec\.ts/,
      dependencies: ['mobile-chromium'],
    },
  ],
  webServer: {
    // Tests run against the production build, service worker included.
    command: `npx vite preview --port ${port} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${port}${base}`,
    reuseExistingServer: !process.env.CI,
  },
});
