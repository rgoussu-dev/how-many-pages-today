import { expect, test, type Page } from '@playwright/test';

const card = (page: Page) => page.locator('hmpt-today-card');
const tab = (page: Page, name: string) => page.locator('.tabbar').getByRole('link', { name, exact: true });
const pagesOnCard = async (page: Page) => Number(await card(page).locator('[data-pages]').textContent());

const welcome = (page: Page) => page.locator('hmpt-welcome');

/** With no bookmark yet, today's page asks for the book on the nightstand first. */
async function putOnNightstand(page: Page, title: string, bookmark = 0, totalPages?: number) {
  const book = card(page);
  await book.getByLabel('The book you are reading').fill(title);
  await book.getByLabel('Your bookmark is at page').fill(String(bookmark));
  if (totalPages !== undefined) await book.getByLabel(/Pages in the book/).fill(String(totalPages));
  await book.getByRole('button', { name: 'Put it on the nightstand' }).click();
  await expect(book.locator('[name="stoppedAt"]')).toBeVisible();
}

/** Writes the page the reading stopped at (or keeps the one the card offers), and seals the day. */
async function sealAt(page: Page, stoppedAt?: number, lastPage = false) {
  const book = card(page);
  if (stoppedAt !== undefined) await book.locator('[name="stoppedAt"]').fill(String(stoppedAt));
  if (lastPage) await book.getByText('That was the last page').click();
  await book.getByRole('button', { name: 'Seal the day' }).click();
}

/** Words the phrasebook could not find, logged by the app — there must be none, in any language. */
const missingPhrases = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }, testInfo) => {
  const missing: string[] = [];
  missingPhrases.set(page, missing);
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().startsWith('No phrase')) missing.push(message.text());
  });
  await page.goto('./');
  await expect(card(page).locator('[data-pages]')).not.toHaveText('…');
  // Tests of the first visit (and any tagged @fresh) start where a new reader does.
  if (testInfo.title.startsWith('welcome:') || testInfo.tags.includes('@fresh')) return;
  // Every other test is a returning reader: step past the first-visit walkthrough,
  // then open the day's book (it waits, closed, for a tap).
  await welcome(page).getByRole('button', { name: 'I know my way' }).click();
  await expect(welcome(page).locator('[data-root]')).toBeHidden();
  await card(page).getByRole('button', { name: 'Open today’s card' }).click();
  await expect(card(page)).not.toHaveAttribute('data-reveal');
});

test.afterEach(async ({ page }) => {
  expect(missingPhrases.get(page) ?? []).toEqual([]);
});

test('deals a card from the default range, with an illustration', async ({ page }) => {
  const pages = await pagesOnCard(page);
  expect(pages % 10).toBe(0);
  expect(pages).toBeGreaterThanOrEqual(10);
  expect(pages).toBeLessThanOrEqual(100);
  const plate = card(page).locator('.tome-inner hmpt-ds-scene');
  await expect(plate.locator('svg')).toBeVisible();
  await expect(plate).toHaveAttribute('aria-label', /.+/);
  await expect(card(page).locator('[data-caption]')).toHaveText((await plate.getAttribute('aria-label')) ?? '');
});

test('writing the page reached seals the card on a scroll, lights the streak, earns a badge, and survives a reload', async ({ page }) => {
  const pages = await pagesOnCard(page);
  await expect(card(page).locator('[data-book-ask]')).toHaveText(
    'First, the book on your nightstand — and the page your bookmark is at.',
  );
  await putOnNightstand(page, 'Persuasion');
  // The card offers the page the day leads to: the bookmark plus the goal.
  await expect(card(page).locator('[name="stoppedAt"]')).toHaveValue(String(pages));
  await sealAt(page);

  await expect(card(page)).toHaveAttribute('data-done', '');
  await expect(card(page)).toHaveAttribute('data-wax', 'met');
  await expect(card(page).locator('[data-scroll]')).toHaveAttribute('data-state', 'open');
  await expect(card(page).locator('[data-head]')).toHaveText('To the page');
  await expect(card(page).locator('[data-read]')).toHaveText(`${pages} pages, exactly as dealt.`);
  await expect(card(page).locator('[data-back-bookmark]')).toHaveText(`Bookmark at page ${pages}.`);
  await expect(page.locator('hmpt-celebration [data-toast]')).toContainText('Achievement unlocked');
  const summary = page.locator('section[data-route="today"] hmpt-streak-summary');
  await expect(summary.locator('[data-streak]')).toHaveText('1');
  await expect(summary.locator('[data-pages]')).toHaveText(String(pages));

  await page.reload();
  await expect(card(page)).toHaveAttribute('data-done', '');
  expect(await pagesOnCard(page)).toBe(pages);
  await expect(card(page).locator('.tome-inner')).toHaveJSProperty('inert', true); // a day read stays read

  await tab(page, 'Progress').click();
  // the first badge is always earned; a 100-page draw would also earn the marathon
  await expect(page.locator('hmpt-achievement-list .badge[data-earned] strong')).toContainText(['First chapter']);
  await expect(page.locator('hmpt-history-calendar li[data-state="completed"]')).toHaveCount(1);
});

test('the scroll rolls up when tapped, and unrolls from its seal', async ({ page }) => {
  await putOnNightstand(page, 'Persuasion');
  await sealAt(page);
  const scroll = card(page).locator('[data-scroll]');
  await expect(scroll).toHaveAttribute('data-state', 'open');
  await expect(card(page).locator('[data-scroll-hint]')).toHaveText('Tap the scroll to roll it up.');
  await card(page).locator('[data-sheet]').click({ position: { x: 40, y: 40 } });
  await expect(scroll).toHaveAttribute('data-state', 'rolled');
  await expect(card(page).locator('[data-scroll-hint]')).toHaveText('Tap the seal to unroll it.');
  await card(page).getByRole('button', { name: 'Unroll the scroll' }).click();
  await expect(scroll).toHaveAttribute('data-state', 'open');
  await card(page).getByRole('button', { name: 'Roll up the scroll' }).click();
  await expect(scroll).toHaveAttribute('data-state', 'rolled');
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

test('fewer pages keep the streak in red wax, and reading on reseals the day in gold', async ({ page }) => {
  const goal = await pagesOnCard(page);
  await putOnNightstand(page, 'Persuasion', 10);
  await sealAt(page, 13);

  await expect(card(page)).toHaveAttribute('data-wax', 'short');
  await expect(card(page).locator('[data-head]')).toHaveText('A short day, honestly kept');
  await expect(card(page).locator('[data-read]')).toHaveText(`3 of ${goal} pages. Every page counts.`);
  const summary = page.locator('section[data-route="today"] hmpt-streak-summary');
  await expect(summary.locator('[data-streak]')).toHaveText('1');
  await expect(summary.locator('[data-pages]')).toHaveText('3');

  // "I read some more" reopens the book onto today's page, which asks how far.
  await card(page).getByRole('button', { name: 'I read some more' }).click();
  await expect(card(page).locator('[data-log-label]')).toHaveText('I read on to page');
  await sealAt(page, 13);
  await expect(card(page).locator('[data-error="log"]')).toHaveText('Your bookmark is already at page 13: a later page, please.');
  await sealAt(page, 23 + goal);
  await expect(card(page)).toHaveAttribute('data-wax', 'beyond');
  await expect(card(page).locator('[data-head]')).toHaveText('Beyond the page');
  await expect(card(page).locator('[data-read]')).toHaveText(`${goal + 13} of ${goal} pages — 13 pages beyond the goal.`);
  await expect(card(page).locator('.tome-inner')).toHaveJSProperty('inert', true); // closed and sealed again

  await tab(page, 'Progress').click();
  const earned = page.locator('hmpt-achievement-list .badge[data-earned] strong');
  await expect(earned).toContainText(['Little by little']);
  await expect(earned).toContainText(['Just one more chapter']);
  await expect(page.locator('hmpt-history-calendar li[data-beyond]')).toHaveCount(1);
});

test('the last page of a book of unknown length finishes it: a gold seal, Explicit, and short pages still meet the goal', async ({ page }) => {
  await putOnNightstand(page, 'Piranesi', 240);
  await sealAt(page, 242, true);
  await expect(card(page)).toHaveAttribute('data-wax', 'book');
  await expect(card(page).locator('[data-head]')).toHaveText('Explicit');
  await expect(card(page).locator('[data-read]')).toHaveText('2 pages — and a book finished. Bravo.');
  await expect(card(page).locator('[data-message]')).toContainText('“Piranesi” — finished.');

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
  await putOnNightstand(page, 'Kindred');
  await sealAt(page, 55, true);
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

test.describe('with motion', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });
  // The opening, the closing and the scroll's ceremony play out in full: give them time.
  test.slow();

  test('welcome: the day’s book waits closed for a tap, opens through the days before, and closes on its back cover', async ({ page }) => {
    const book = card(page);
    const goal = await book.locator('[data-pages]').textContent();
    await expect(book).toHaveAttribute('data-reveal', 'closed');
    await expect(book.locator('.tome-cover-date')).not.toBeEmpty();

    await welcome(page).getByRole('button', { name: 'I know my way' }).click();
    await page.waitForTimeout(1200);
    await expect(book).toHaveAttribute('data-reveal', 'closed'); // it waits for the reader
    await expect(book.locator('.tome-inner')).toHaveJSProperty('inert', true);

    // A first book: the spread the camera pulls back to is its front matter.
    await expect(book.locator('[data-cover-back]')).toContainText('Ex libris');
    await expect(book.locator('[data-leaf]')).toContainText('Chapter');

    await book.getByRole('button', { name: 'Open today’s card' }).press('Enter'); // keyboard opens it too
    await expect(book).toHaveAttribute('data-reveal', 'opening');
    await expect(book.locator('.tome-leaves')).toBeVisible();
    await expect(book).not.toHaveAttribute('data-reveal', { timeout: 9000 });
    await expect(book.locator('[data-pages]')).toHaveText(goal ?? '');
    await expect(book.locator('[data-folio]')).toHaveText(`— ${goal} —`);
    await expect(book.locator('.tome-inner')).toHaveJSProperty('inert', false);

    // No bookmark yet: the page asks for the book first. Then reading: pull back, turn today's
    // page, turn the book over onto its back — and the scroll is written and sealed.
    await putOnNightstand(page, 'Persuasion');
    await sealAt(page);
    await expect(book).toHaveAttribute('data-closing', '');
    await expect(book.locator('[data-cover-back] .past-verso')).toHaveCount(1); // the left half, closing up
    await expect(book.locator('[data-scroll]')).toHaveAttribute('data-state', 'playing');
    await expect(book).not.toHaveAttribute('data-closing', { timeout: 9000 });
    await expect(book.locator('.tome-back-face')).toBeVisible();
    await expect(book.locator('.candle')).toBeVisible({ timeout: 9000 }); // the candle comes up to pour
    await expect(book.locator('[data-scroll]')).toHaveAttribute('data-state', 'open', { timeout: 25000 });
    await expect(book.locator('[data-message]')).not.toBeEmpty();
    await expect(book.locator('.tome-inner')).toHaveJSProperty('inert', true);

    // Rolled up on a tap, unrolled from the seal.
    await book.locator('[data-sheet]').click({ position: { x: 40, y: 40 } });
    await expect(book.locator('[data-scroll]')).toHaveAttribute('data-state', 'rolled');
    await book.getByRole('button', { name: 'Unroll the scroll' }).click();
    await expect(book.locator('[data-scroll]')).toHaveAttribute('data-state', 'open');

    // Reopening it later: the closing rewound, onto today's page; closing it again, replayed.
    await book.getByRole('button', { name: 'I read some more' }).click();
    await expect(book).toHaveAttribute('data-closing', 'reopen');
    await expect(book).not.toHaveAttribute('data-closing', { timeout: 6000 });
    await expect(book.locator('.tome-inner')).toHaveJSProperty('inert', false);
    await expect(book.locator('[name="stoppedAt"]')).toBeFocused();
    await book.getByRole('button', { name: 'Close the book' }).click();
    await expect(book).toHaveAttribute('data-closing', 'again');
    await expect(book).not.toHaveAttribute('data-closing', { timeout: 6000 });
    await expect(book.locator('.tome-back-face')).toBeVisible();
    await expect(book.getByRole('button', { name: 'Roll up the scroll' })).toBeFocused();

    await page.reload();
    await expect(book.locator('[data-pages]')).toHaveText(goal ?? '');
    await page.waitForTimeout(500);
    await expect(book).not.toHaveAttribute('data-reveal'); // opened once a day
    await expect(book).not.toHaveAttribute('data-closing'); // closed once, when read
    await expect(book.locator('.tome-back-face')).toBeVisible(); // and stays closed
    await expect(book.locator('[data-scroll]')).toHaveAttribute('data-state', 'open'); // the scroll lies open, sealed
  });

  test('a tap skips the ceremony straight to the sealed scroll', { tag: '@fresh' }, async ({ page }) => {
    const book = card(page);
    await welcome(page).getByRole('button', { name: 'I know my way' }).click();
    await book.getByRole('button', { name: 'Open today’s card' }).click();
    await expect(book).not.toHaveAttribute('data-reveal', { timeout: 9000 });
    await putOnNightstand(page, 'Persuasion');
    await sealAt(page);
    await expect(book).not.toHaveAttribute('data-closing', { timeout: 9000 });
    await expect(book.locator('[data-scroll-hint]')).toHaveText('Tap to skip ahead');
    await book.locator('.tome-back-face').click({ position: { x: 30, y: 30 } });
    await expect(book.locator('[data-scroll]')).toHaveAttribute('data-state', 'open');
    await expect(book.locator('[data-read]')).not.toBeEmpty();
  });

  test('the open book shows the two days before today', { tag: '@fresh' }, async ({ page }) => {
    await welcome(page).getByRole('button', { name: 'I know my way' }).click();
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const open = indexedDB.open('how-many-pages-today');
        open.onsuccess = () => resolve(open.result);
      });
      const tx = db.transaction('challenges', 'readwrite');
      const pad = (n: number) => String(n).padStart(2, '0');
      const key = (back: number) => {
        const d = new Date();
        d.setDate(d.getDate() - back);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      tx.objectStore('challenges').put({ day: key(2), pages: 40, artSeed: 1, status: 'completed', drawnAt: '', pagesRead: 52, goalMet: true });
      tx.objectStore('challenges').put({ day: key(1), pages: 30, artSeed: 2, status: 'pending', drawnAt: '' });
      await new Promise((resolve) => (tx.oncomplete = resolve));
    });
    await page.reload();
    const book = card(page);
    await expect(book).toHaveAttribute('data-reveal', 'closed');
    // The day before yesterday is carried on the inside of the half that falls open.
    await expect(book.locator('[data-cover-back] .past-number')).toHaveText('52');
    await expect(book.locator('[data-cover-back] .past-note')).toHaveText('52 pages read · sealed');
    await expect(book.locator('[data-leaf] .past-note')).toHaveText('pages dealt, left unread');
  });
});

test.describe('in French', () => {
  test.use({ locale: 'fr-FR' });

  test('a French browser is welcomed, and read to, in French', { tag: '@fresh' }, async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-FR');
    const w = welcome(page);
    await expect(w.getByRole('heading', { name: 'La salle de lecture' })).toBeVisible();
    await expect(page).toHaveTitle('Combien de pages aujourd’hui');
    await w.getByRole('button', { name: 'Je connais la maison' }).click();
    await expect(tab(page, 'Aujourd’hui')).toBeVisible();

    await card(page).getByRole('button', { name: 'Ouvrir la carte du jour' }).click();
    const pages = await pagesOnCard(page);
    await expect(card(page).locator('[data-date]')).toHaveText(
      new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        .format(new Date())
        .replace(/^./, (c) => c.toUpperCase()),
    );
    await expect(card(page).locator('[data-caption]')).toHaveText(/^(Des|Une|Un) /); // the plate, described in French
    await card(page).getByLabel('Le livre que vous lisez').fill('Les Misérables');
    await card(page).getByRole('button', { name: 'Sur la table de chevet\u202f!' }).click();
    await expect(card(page).locator('[data-log-label]')).toHaveText('J’ai lu jusqu’à la page');
    await expect(card(page).locator('[name="stoppedAt"]')).toHaveValue(String(pages));
    await card(page).getByRole('button', { name: 'Sceller la journée' }).click();
    await expect(card(page).locator('[data-head]')).toHaveText('Pile à la page');
    await expect(card(page).locator('[data-read]')).toHaveText(`${pages} pages, pile comme prévu.`);
    await expect(card(page).locator('[data-sign]')).toHaveText('Le bibliothécaire');

    await tab(page, 'Progrès').click();
    await expect(page.locator('h1:visible')).toHaveText('Votre bibliothèque');
    await expect(page.locator('hmpt-achievement-list .badge[data-earned] strong')).toContainText(['Premier chapitre']);
    await expect(page.locator('hmpt-history-calendar .calendar-head span').first()).toHaveText('L');
  });
});

test('the reading room speaks the language the reader picks, and the device’s again on asking', async ({ page }) => {
  await tab(page, 'You').click();
  const form = page.locator('hmpt-language-form');
  await expect(form.getByLabel('As on this device (English)')).toBeChecked();
  await form.getByText('Français').click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(tab(page, 'Vous')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('section[data-route="profile"] h1')).toHaveText('Votre salle de lecture');
  await expect(page).toHaveTitle('Vous · Combien de pages aujourd’hui');
  await expect(page.locator('hmpt-range-form').getByRole('button', { name: 'Enregistrer la fourchette' })).toBeVisible();
  await expect(form.getByLabel('Comme cet appareil (English)')).not.toBeChecked();

  await page.reload();
  await tab(page, 'Aujourd’hui').click(); // the choice is kept
  await expect(card(page).getByRole('button', { name: 'Sur la table de chevet\u202f!' })).toBeVisible();

  await tab(page, 'Vous').click();
  await form.getByText('Comme cet appareil (English)').click();
  await expect(tab(page, 'You')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', /^en/);
});

test('welcome: the librarian can be asked, at the door, to speak French', async ({ page }) => {
  const w = welcome(page);
  await w.getByText('Français').click();
  await expect(w.getByRole('heading', { name: 'La salle de lecture' })).toBeVisible();
  await w.getByRole('button', { name: 'Entrer' }).click();
  await expect(w.getByRole('heading', { name: 'Votre carte de lecture' })).toBeVisible();
  await w.getByRole('button', { name: 'Signer le registre' }).click();
  await expect(w.locator('[data-error="displayName"]')).toHaveText('Il me faut un nom pour la carte — un surnom fera l’affaire\u202f!');
});

test('welcome: the book on the nightstand keeps its bookmark, and every day says which page to read to', async ({ page }) => {
  const w = welcome(page);
  await w.getByRole('button', { name: 'Step inside' }).click();
  await w.getByRole('button', { name: 'Later' }).click();
  await w.getByLabel('The book you are reading').fill('Middlemarch');
  await w.getByLabel(/Your bookmark is at page/).fill('112');
  await w.getByLabel(/Pages in the book/).fill('880');
  await w.getByRole('button', { name: 'Put it on the nightstand' }).click();
  await expect(w.locator('[data-bubble-title]')).toHaveText('Your daily card');
  await page.keyboard.press('Escape');

  await expect(page.locator('hmpt-greeting [data-sub]')).toHaveText('On the nightstand: Middlemarch, page 112.');
  // The book's own bookmark peeks out of the closed book, the page written on it.
  const bookmark = card(page).locator('[data-bookmark]');
  await expect(bookmark).toBeVisible();
  await expect(bookmark.locator('.ds-bookmark-mark')).toHaveText('p. 112');
  await expect(bookmark).toHaveAttribute('aria-label', 'Bookmark in “Middlemarch”, at page 112');
  await card(page).getByRole('button', { name: 'Open today’s card' }).click();
  const goal = await pagesOnCard(page);
  await expect(card(page).locator('[data-until]')).toHaveText(`up to page ${112 + goal}`);

  // The page offered is the one the day leads to; one before the bookmark is refused.
  await expect(card(page).locator('[name="stoppedAt"]')).toHaveValue(String(112 + goal));
  await sealAt(page, 100);
  await expect(card(page).locator('[data-error="log"]')).toHaveText('Your bookmark is already at page 112: a later page, please.');
  await sealAt(page, 1000);
  await expect(card(page).locator('[data-error="log"]')).toHaveText('This book ends at page 880.');
  // Reading moves the bookmark to the page reached.
  await sealAt(page, 142);
  await expect(card(page).locator('[data-back-bookmark]')).toHaveText('Bookmark at page 142 of 880.');
  // Turned over onto its back, the book shows its bookmark at the other edge, at the new page.
  await expect(bookmark).toHaveAttribute('side', 'right');
  await expect(bookmark.locator('.ds-bookmark-mark')).toHaveText('p. 142');
  await expect(page.locator('hmpt-greeting [data-sub]')).toHaveText('On the nightstand: Middlemarch, page 142.');

  await tab(page, 'Progress').click();
  const shelf = page.locator('hmpt-bookshelf');
  await expect(shelf.locator('[data-bookmark-text]')).toHaveText('Page 142 of 880');
  await expect(shelf.locator('[data-progress]')).toHaveAttribute('aria-valuenow', '16');

  // Reading on later the same day moves it too.
  await tab(page, 'Today').click();
  await card(page).getByRole('button', { name: 'I read some more' }).click();
  await expect(bookmark).not.toHaveAttribute('side');
  await expect(card(page).locator('[data-until]')).toHaveText('Bookmark at page 142 of 880.');
  await sealAt(page, 150);
  await expect(card(page).locator('[data-back-bookmark]')).toHaveText('Bookmark at page 150 of 880.');
  await expect(bookmark.locator('.ds-bookmark-mark')).toHaveText('p. 150');
});

test('the bookmark can be moved by hand, and reaching the last page shelves the book', async ({ page }) => {
  await tab(page, 'Progress').click();
  const shelf = page.locator('hmpt-bookshelf');
  await shelf.getByLabel('What are you reading?').fill('Piranesi');
  await shelf.getByRole('button', { name: 'Start reading' }).click();
  await expect(shelf.locator('[data-bookmark-text]')).toHaveText('Bookmark at page 0');

  const goal = await pagesOnCard(page);
  await shelf.getByText('Move the bookmark').click();
  await shelf.locator('[data-move-form]').getByLabel('On page').fill('240');
  await shelf.locator('[data-move-form]').getByLabel(/Pages in the book/).fill('100');
  await shelf.locator('[data-move-form]').getByRole('button', { name: 'Save' }).click();
  await expect(shelf.locator('[data-move-form] [data-error="bookmark"]')).toHaveText('The book ends at page 100.');
  await shelf.locator('[data-move-form]').getByLabel(/Pages in the book/).fill(String(240 + goal));
  await shelf.locator('[data-move-form]').getByRole('button', { name: 'Save' }).click();
  await expect(shelf.locator('[data-move-status]')).toHaveText('Saved ✓');
  await expect(shelf.locator('[data-bookmark-text]')).toHaveText(`Page 240 of ${240 + goal}`);

  await tab(page, 'Today').click();
  await expect(card(page).locator('[data-until]')).toHaveText(`to the end of the book — page ${240 + goal}`);
  await expect(card(page).locator('[data-last-field]')).toBeHidden(); // its length is known: the last page says it all
  await sealAt(page);
  await expect(card(page)).toHaveAttribute('data-wax', 'book');
  await expect(card(page).locator('[data-head]')).toHaveText('Explicit');
  await expect(card(page).locator('[data-bookmark]')).toBeHidden(); // it went to the shelf with the book
});
