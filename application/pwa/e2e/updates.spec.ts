import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/*
 * A new version of the app, shipped while the reader has it open. The test ships one by
 * changing the built service worker on disk (the preview server reads it afresh), so it runs
 * in a project of its own, after every other test (see playwright.config.ts).
 */
const worker = fileURLToPath(new URL('../dist/sw.js', import.meta.url));

test('a new version waits to be opened: the shell offers it, and opening it reloads into it', async ({ page }) => {
  const original = readFileSync(worker, 'utf8');
  try {
    await page.goto('./');
    // A returning reader: past the walkthrough, the day's book opened.
    await page.locator('hmpt-welcome').getByRole('button', { name: 'I know my way' }).click();
    await expect(page.locator('hmpt-welcome [data-root]')).toBeHidden();
    await page.locator('hmpt-today-card').getByRole('button', { name: 'Open today’s card' }).click();
    await expect(page.locator('hmpt-today-card')).not.toHaveAttribute('data-reveal');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // let the worker take control
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    const slip = page.locator('[data-update]');
    await expect(slip).toBeHidden(); // the first install is not an update

    // A new edition ships; the app looks for it (as it does when it comes back to the foreground).
    appendFileSync(worker, '\n// the next edition\n');
    await page.evaluate(() => {
      (window as unknown as { beforeUpdate: boolean }).beforeUpdate = true;
      return navigator.serviceWorker.getRegistration().then((registration) => registration?.update());
    });
    await expect(slip).toBeVisible();
    await expect(slip).toContainText('A new edition is on the shelf.');

    // "Later" puts it away: nothing changes under the reader's feet.
    await slip.getByRole('button', { name: 'Later' }).click();
    await expect(slip).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { beforeUpdate?: boolean }).beforeUpdate)).toBe(true);

    // It is offered again on the next visit; opening it reloads the page into the new version.
    await page.reload();
    await expect(slip).toBeVisible();
    await Promise.all([page.waitForEvent('load'), slip.getByRole('button', { name: 'Open it' }).click()]);
    await expect(slip).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { beforeUpdate?: boolean }).beforeUpdate)).toBeUndefined();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.waiting === null && registration.active?.state === 'activated';
        }),
      )
      .toBe(true);
  } finally {
    writeFileSync(worker, original);
  }
});
