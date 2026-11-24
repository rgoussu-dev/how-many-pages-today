import { expect, test, type Page } from '@playwright/test';

const card = (page: Page) => page.locator('hmpt-today-card');
const tab = (page: Page, name: string) => page.locator('.tabbar').getByRole('link', { name, exact: true });
const pagesOnCard = async (page: Page) => Number(await card(page).locator('[data-pages]').textContent());

const welcome = (page: Page) => page.locator('hmpt-welcome');

test.beforeEach(async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(card(page).locator('[data-pages]')).not.toHaveText('…');
  if (testInfo.title.startsWith('welcome:')) return;
  // Every other test is a returning reader: step past the first-visit walkthrough.
  await welcome(page).getByRole('button', { name: 'I know my way' }).click();
  await expect(welcome(page).locator('[data-root]')).toBeHidden();
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
  // the first badge is always earned; a 100-page draw would also earn the marathon
  await expect(page.locator('hmpt-achievement-list .badge[data-earned] strong')).toContainText(['First chapter']);
  await expect(page.locator('hmpt-history-calendar li[data-state="completed"]')).toHaveCount(1);

  // a day read stays read: no way back, no second validation
  await tab(page, 'Today').click();
  await expect(card(page).getByRole('button', { name: /^I read/ })).toBeHidden();
  await expect(card(page).locator('.tome-done')).toHaveText('Read, and sealed.');
  await expect(card(page).locator('[data-read]')).toHaveText(`${pages} pages, exactly as dealt.`);
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

test('logging fewer pages keeps the streak, earns encouragement, and more can be added later', async ({ page }) => {
  const goal = await pagesOnCard(page);
  await card(page).getByText('Read more, or fewer?').click();
  await card(page).getByLabel('Pages actually read').fill('3');
  await card(page).getByRole('button', { name: 'Log my reading' }).click();

  await expect(card(page)).toHaveAttribute('data-done', '');
  await expect(card(page).locator('[data-read]')).toHaveText(`3 of ${goal} pages. Every page counts.`);
  const summary = page.locator('section[data-route="today"] hmpt-streak-summary');
  await expect(summary.locator('[data-streak]')).toHaveText('1');
  await expect(summary.locator('[data-pages]')).toHaveText('3');

  await card(page).getByText('Read some more today?').click();
  await card(page).getByLabel('Pages to add').fill(String(goal + 10));
  await card(page).getByRole('button', { name: 'Add pages' }).click();
  await expect(card(page).locator('[data-read]')).toHaveText(`${goal + 13} of ${goal} pages — 13 pages beyond the goal.`);

  await tab(page, 'Progress').click();
  const earned = page.locator('hmpt-achievement-list .badge[data-earned] strong');
  await expect(earned).toContainText(['Little by little']);
  await expect(earned).toContainText(['Just one more chapter']);
  await expect(page.locator('hmpt-history-calendar li[data-beyond]')).toHaveCount(1);
});

test('a book can be finished from the card, named there, and short pages still meet the goal', async ({ page }) => {
  await card(page).getByText('Read more, or fewer?').click();
  await card(page).getByLabel('Pages actually read').fill('2');
  await card(page).getByText('I finished my book').click();
  await card(page).getByLabel(/Which book/).fill('Piranesi');
  await card(page).getByRole('button', { name: 'Log my reading' }).click();
  await expect(card(page).locator('[data-read]')).toHaveText('2 pages — and a book finished. Bravo.');

  await tab(page, 'Progress').click();
  await expect(page.locator('hmpt-bookshelf .spine')).toHaveAttribute('aria-label', /^Piranesi, finished /);
  await expect(page.locator('hmpt-history-calendar li[data-short]')).toHaveCount(0);
  await expect(page.locator('hmpt-achievement-list .badge[data-earned] strong')).toContainText(['The final chapter']);
});

test('a book can be shelved without a title', async ({ page }) => {
  await tab(page, 'Progress').click();
  const shelf = page.locator('hmpt-bookshelf');
  await shelf.getByText('Finished a book?').click();
  await shelf.getByRole('button', { name: 'Put it on the shelf' }).click();
  await expect(shelf.locator('.spine')).toHaveAttribute('aria-label', /^A book, finished /);
  await expect(page.locator('section[data-route="progress"] hmpt-streak-summary [data-books]')).toHaveText('1');
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

test('the overview looks back over the month and the year', async ({ page }) => {
  await card(page).getByText('Read more, or fewer?').click();
  await card(page).getByLabel('Pages actually read').fill('55');
  await card(page).getByText('I finished my book').click();
  await card(page).getByLabel(/Which book/).fill('Kindred');
  await card(page).getByRole('button', { name: 'Log my reading' }).click();
  await expect(card(page)).toHaveAttribute('data-done', '');

  await tab(page, 'Overview').click();
  const overview = page.locator('hmpt-reading-overview');
  const now = new Date();
  await expect(overview.locator('[data-title]')).toHaveText(
    new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(now),
  );
  await expect(overview.locator('[data-pages]')).toHaveText('55');
  await expect(overview.locator('[data-books]')).toHaveText('1');
  await expect(overview.locator('.ov-book cite')).toHaveText(['Kindred']);
  await expect(overview.getByRole('button', { name: 'Next month' })).toBeDisabled();

  // every value is reachable without hovering: the table view, and keyboard focus
  await overview.getByText('Show as a table').click();
  await expect(overview.locator('[data-table] tr')).toHaveCount(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
  );
  await overview.locator(`.ov-columns li`).nth(now.getDate() - 1).focus();
  await expect(overview.locator('[data-tooltip]')).toBeVisible();
  await expect(overview.locator('[data-tip-value]')).toHaveText('55 pages');

  await overview.getByRole('button', { name: 'Year' }).click();
  await expect(overview.locator('[data-title]')).toHaveText(String(now.getFullYear()));
  await expect(overview.locator('.ov-columns li')).toHaveCount(12);
  await expect(overview.locator('[data-pages]')).toHaveText('55');
  await expect(overview.locator('.ov-book-month')).toHaveCount(1);
});

test('welcome: a first visit is a short story that fills in the reader and shows the room', async ({ page }) => {
  const w = welcome(page);
  await expect(w.getByRole('heading', { name: 'The reading room' })).toBeFocused();
  await expect(page.locator('.app')).toHaveJSProperty('inert', true);
  await w.getByRole('button', { name: 'Step inside' }).click();

  await w.getByRole('button', { name: 'Sign the register' }).click(); // no name yet
  await expect(w.locator('[data-error="displayName"]')).not.toBeEmpty();
  await w.getByText('🦊').click();
  await w.getByLabel('What shall I call you?').fill('Ada');
  await w.getByRole('button', { name: 'Sign the register' }).click();

  await expect(w.locator('[data-greet]')).toContainText('A pleasure, Ada.');
  await w.getByLabel('The book you are reading').fill('The Dispossessed');
  await w.getByRole('button', { name: 'Put it on the nightstand' }).click();

  const titles = ['Your daily card', 'Keep the candle lit', 'Your library', 'Looking back', 'Your reading room'];
  for (const [i, title] of titles.entries()) {
    await expect(w.locator('[data-bubble-title]')).toHaveText(title);
    await expect(w.locator('[data-bubble-count]')).toHaveText(`A tour of the room · ${i + 1} of 5`);
    await expect(page.locator('[data-tour-lit]')).toHaveCount(1);
    await w.getByRole('button', { name: i === titles.length - 1 ? 'Onward' : 'Next' }).click();
  }

  await expect(w.getByRole('heading', { name: 'A key to the room' })).toBeVisible();
  await w.locator('[data-body] [data-action="next"]').last().click();

  await expect(w.locator('[data-finale]')).toContainText('Ada');
  await expect(w.locator('[data-finale]')).toContainText('your first bookplate: “Pleased to meet you”');
  await w.getByRole('button', { name: 'Turn the first page' }).click();

  await expect(w.locator('[data-root]')).toBeHidden();
  await expect(page.locator('.app')).toHaveJSProperty('inert', false);
  await expect(page.locator('hmpt-greeting h1')).toContainText('Ada');
  await expect(page.locator('hmpt-greeting cite')).toHaveText('The Dispossessed');
  await expect(page.locator('hmpt-greeting [data-avatar]')).toHaveText('🦊');

  await page.reload();
  await expect(card(page).locator('[data-pages]')).not.toHaveText('…');
  await expect(w.locator('[data-root]')).toBeHidden();
});

test('welcome: Escape skips it for good, and it can be taken again from the reading room', async ({ page }) => {
  const w = welcome(page);
  await w.getByRole('button', { name: 'Step inside' }).click();
  await w.getByLabel('What shall I call you?').fill('Ada');
  await w.getByRole('button', { name: 'Sign the register' }).click();
  await expect(w.getByRole('heading', { name: 'The book in hand' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(w.locator('[data-root]')).toBeHidden();

  await page.reload();
  await expect(card(page).locator('[data-pages]')).not.toHaveText('…');
  await expect(w.locator('[data-root]')).toBeHidden();

  await tab(page, 'You').click();
  await page.getByRole('button', { name: /Take the tour again/ }).click();
  await expect(w.getByRole('heading', { name: 'The reading room' })).toBeVisible();
  await expect(page).toHaveURL(/#today$/);
  await w.getByRole('button', { name: 'Step inside' }).click();
  await expect(w.getByLabel('What shall I call you?')).toHaveValue('Ada'); // the card remembers
});

test('welcome: where the browser offers to install, the librarian hands over the key', async ({ page }) => {
  await welcome(page).getByRole('button', { name: 'I know my way' }).click();
  // Simulate Chromium's install prompt (headless browsers never fire one).
  await page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {
        (window as unknown as { prompted: boolean }).prompted = true;
      },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);
  });
  await tab(page, 'You').click();
  await page.getByRole('button', { name: /Take the tour again/ }).click();
  const w = welcome(page);
  await w.getByRole('button', { name: 'Step inside' }).click();
  await w.getByRole('button', { name: 'Later' }).click();
  await w.getByRole('button', { name: 'Nothing just now' }).click();
  for (let i = 0; i < 4; i++) await w.getByRole('button', { name: 'Next' }).click();
  await w.getByRole('button', { name: 'Onward' }).click();

  await w.getByRole('button', { name: 'Add it to my home screen' }).click();
  await expect(w.locator('[data-install-status]')).toHaveText('“Splendid. The key is on your home screen.”');
  expect(await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
  await w.getByRole('button', { name: 'Onward' }).click();
  await expect(w.getByRole('heading', { name: 'Your first card awaits' })).toBeVisible();
});
