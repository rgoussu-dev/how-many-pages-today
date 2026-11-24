import { expect, test, type Page } from '@playwright/test';

const card = (page: Page) => page.locator('hmpt-today-card');
const tab = (page: Page, name: string) => page.locator('.tabbar').getByRole('link', { name, exact: true });
const pagesOnCard = async (page: Page) => Number(await card(page).locator('[data-pages]').textContent());

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(card(page).locator('[data-pages]')).not.toHaveText('…');
});

test('deals a card from the default range, with an illustration', async ({ page }) => {
  const pages = await pagesOnCard(page);
  expect(pages % 10).toBe(0);
  expect(pages).toBeGreaterThanOrEqual(10);
  expect(pages).toBeLessThanOrEqual(100);
  await expect(card(page).locator('hmpt-ds-scene svg')).toBeVisible();
  await expect(card(page).locator('hmpt-ds-scene')).toHaveAttribute('aria-label', /.+/);
});

test('validating the day seals the card, lights the streak, earns a badge, and survives a reload', async ({ page }) => {
  const pages = await pagesOnCard(page);
  await card(page).getByRole('button', { name: /^I read/ }).click();

  await expect(card(page)).toHaveAttribute('data-done', '');
  await expect(page.locator('hmpt-celebration [data-toast]')).toContainText(/read|Achievement/);
  const summary = page.locator('section[data-route="today"] hmpt-streak-summary');
  await expect(summary.locator('[data-streak]')).toHaveText('1');
  await expect(summary.locator('[data-pages]')).toHaveText(String(pages));

  await page.reload();
  await expect(card(page)).toHaveAttribute('data-done', '');
  expect(await pagesOnCard(page)).toBe(pages);

  await tab(page, 'Progress').click();
  await expect(page.locator('hmpt-achievement-list [data-count]')).toHaveText(/^1 \/ \d+$/);
  await expect(page.locator('hmpt-history-calendar li[data-state="completed"]')).toHaveCount(1);

  // a day read stays read: no way back, no second validation
  await tab(page, 'Today').click();
  await expect(card(page).getByRole('button')).toHaveCount(0);
  await expect(card(page).locator('[data-done-note]')).toHaveText('Read, and sealed.');
});

test('works offline once installed', async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // let the worker take control
  const pages = await pagesOnCard(page);
  await context.setOffline(true);
  await page.reload();
  await expect(card(page).locator('[data-pages]')).toHaveText(String(pages));
  await context.setOffline(false);
});

test('a new range redraws an unread card that no longer fits', async ({ page }) => {
  await tab(page, 'You').click();
  const form = page.locator('hmpt-range-form');
  await form.getByLabel('Minimum').fill('7');
  await form.getByLabel('Maximum').fill('7');
  await form.getByLabel('Step').fill('1');
  await expect(form.locator('[data-preview] .chip')).toHaveText(['7']);
  await form.getByRole('button', { name: 'Save range' }).click();
  await expect(form.locator('[data-status]')).toContainText('redrawn');

  await tab(page, 'Today').click();
  expect(await pagesOnCard(page)).toBe(7);
});

test('rejects an inverted range with a message on the field', async ({ page }) => {
  await tab(page, 'You').click();
  const form = page.locator('hmpt-range-form');
  await form.getByLabel('Minimum').fill('50');
  await form.getByLabel('Maximum').fill('20');
  await form.getByRole('button', { name: 'Save range' }).click();
  await expect(form.locator('[data-error="max"]')).toContainText('cannot be below');
});

test('the profile stays on the device and greets the reader', async ({ page }) => {
  await tab(page, 'You').click();
  const form = page.locator('hmpt-profile-form');
  await form.getByText('🦉').click();
  await form.getByLabel('Name').fill('Ada');
  await form.getByRole('button', { name: 'Save profile' }).click();
  await expect(form.locator('[data-status]')).toHaveText('Saved ✓');

  await tab(page, 'Today').click();
  await expect(page.locator('hmpt-greeting h1')).toContainText('Ada');
  await expect(page.locator('hmpt-greeting [data-avatar]')).toHaveText('🦉');
  await page.reload();
  await expect(page.locator('hmpt-greeting h1')).toContainText('Ada');
});

test('books go from the nightstand to the shelf, and count as books read', async ({ page }) => {
  await tab(page, 'Progress').click();
  const shelf = page.locator('hmpt-bookshelf');
  await expect(shelf.locator('[data-empty]')).toBeVisible();
  await shelf.getByLabel('What are you reading?').fill('The Left Hand of Darkness');
  await shelf.getByRole('button', { name: 'Start reading' }).click();
  await expect(shelf.locator('[data-current]')).toHaveText('The Left Hand of Darkness');

  await tab(page, 'Today').click();
  await expect(page.locator('hmpt-greeting cite')).toHaveText('The Left Hand of Darkness');

  await tab(page, 'Progress').click();
  await shelf.getByRole('button', { name: 'I finished it' }).click();
  await expect(shelf.locator('.spine')).toHaveCount(1);
  await expect(shelf.locator('.spine')).toHaveAttribute('aria-label', /^The Left Hand of Darkness, finished /);
  await expect(shelf.locator('[data-count]')).toHaveText('1 book');
  await expect(page.locator('section[data-route="progress"] hmpt-streak-summary [data-books]')).toHaveText('1');
  await expect(page.locator('hmpt-celebration [data-toast]')).toContainText('joins your shelf');

  await page.reload();
  await expect(shelf.locator('.spine')).toHaveCount(1);
  await expect(shelf.locator('[data-nightstand]')).toBeHidden();
});

test('a daily reminder fires at the chosen time while the app is open', async ({ page, context }) => {
  await context.grantPermissions(['notifications']);
  await page.clock.install({ time: new Date('2026-11-24T07:00:00') });
  await page.addInitScript(() => {
    // Headless Chromium reports `granted` through the Permissions API but leaves
    // Notification.permission at `denied`, and refuses to display notifications;
    // real browsers do both. Align the permission and record what would be shown.
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    const shown: string[] = [];
    (window as unknown as { shown: string[] }).shown = shown;
    ServiceWorkerRegistration.prototype.showNotification = async function (title, options) {
      shown.push(`${title} | ${options?.body ?? ''}`);
    };
  });
  await page.reload();
  const shown = () => page.evaluate(() => (window as unknown as { shown: string[] }).shown);

  await tab(page, 'You').click();
  const form = page.locator('hmpt-reminder-form');
  await form.getByRole('switch').check();
  await form.getByLabel('At').fill('07:30');
  await form.getByRole('button', { name: 'Save reminder' }).click();
  await expect(form.locator('[data-status]')).toContainText('Saved ✓');

  await form.getByRole('button', { name: 'Send a test' }).click();
  await expect(form.locator('[data-status]')).toContainText('Test sent');
  expect((await shown()).join('\n')).toContain('This is what your reminder will look like');

  await page.clock.fastForward('31:00'); // 07:31 — the foreground timer fires the check
  await expect.poll(async () => (await shown()).length).toBe(2);
  expect((await shown())[1]).toMatch(/How many pages today\? \| Today's card: \d+ pages/);

  await page.clock.fastForward('10:00'); // never twice the same day
  expect(await shown()).toHaveLength(2);
});

test('the calendar fallback downloads a daily recurring event with an alarm', async ({ page }) => {
  await tab(page, 'You').click();
  const form = page.locator('hmpt-reminder-form');
  await form.getByLabel('At').fill('21:15');
  await form.getByText('Want a reminder that never misses?').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    form.getByRole('button', { name: /Add to my calendar/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('daily-reading-reminder.ics');
  const stream = await download.createReadStream();
  let ics = '';
  for await (const chunk of stream) ics += chunk;
  expect(ics).toContain('RRULE:FREQ=DAILY');
  expect(ics).toMatch(/DTSTART:\d{8}T211500\r\n/);
  expect(ics).toContain('BEGIN:VALARM');
});
