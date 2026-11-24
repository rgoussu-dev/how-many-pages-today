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
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    // Tests run against the production build, service worker included.
    command: `npx vite preview --port ${port} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${port}${base}`,
    reuseExistingServer: !process.env.CI,
  },
});
