import { beforeEach, describe, expect, it } from 'vitest';
import type { ReadingEvent, ReadingSnapshot } from '@hmpt/domain-contract';
import { createReadingApp } from './reading-app';
import { inMemoryDeps, type InMemoryDeps } from './testing';

const at = (day: number, hour = 9, minute = 0) => new Date(2026, 10, day, hour, minute);

describe('the daily challenge', () => {
  let deps: InMemoryDeps;
  let app: ReturnType<typeof createReadingApp>;
  let snapshot: ReadingSnapshot | null;
  let events: ReadingEvent[];

  beforeEach(() => {
    deps = inMemoryDeps(at(24), [0.35]);
    app = createReadingApp(deps);
    snapshot = null;
    events = [];
    app.view.subscribe((s) => (snapshot = s));
    app.view.onEvent((e) => events.push(e));
  });

  it('draws one card per day and keeps it on reopening', async () => {
    const first = await app.challenge.open();
    deps.random.next(); // a later draw would differ…
    const again = await app.challenge.open();
    expect(first).toEqual(again); // …but the card is already drawn
    expect(first).toMatchObject({ day: '2026-11-24', pages: 40, status: 'pending' });
    expect(snapshot?.today.pages).toBe(40);
  });

  it('deals a card face down, and remembers the first time it is opened', async () => {
    const first = await app.challenge.open();
    expect(first.unveiledAt).toBeUndefined();
    deps.clock.set(at(24, 9, 5));
    const opened = await app.challenge.unveil();
    expect(opened.unveiledAt).toBe(at(24, 9, 5).toISOString());
    deps.clock.set(at(24, 11, 0));
    expect((await app.challenge.unveil()).unveiledAt).toBe(at(24, 9, 5).toISOString());
    expect(snapshot?.today.unveiledAt).toBe(at(24, 9, 5).toISOString());
    expect(snapshot?.today.pages).toBe(first.pages); // opening never redraws
  });

  it('validates the day, starts a streak and unlocks the first achievement', async () => {
    await app.challenge.open();
    const result = await app.challenge.complete();
    expect(result.ok).toBe(true);
    expect(snapshot?.stats).toMatchObject({ currentStreak: 1, totalPages: 40, completedCount: 1 });
    expect(events.map((e) => e.type)).toEqual(['challenge-completed', 'achievement-unlocked']);
    expect(snapshot?.achievements.find((a) => a.id === 'first-challenge')?.unlockedOn).toBe('2026-11-24');
  });

  it('refuses to validate twice: a day read stays read', async () => {
    await app.challenge.complete();
    expect(await app.challenge.complete()).toEqual({ ok: false, error: 'already-completed' });
    expect(snapshot?.stats.currentStreak).toBe(1);
  });

  it('builds a streak over consecutive days and unlocks Kindling on the third', async () => {
    for (const day of [22, 23, 24]) {
      deps.clock.set(at(day));
      await app.challenge.complete();
    }
    expect(snapshot?.stats.currentStreak).toBe(3);
    expect(events.filter((e) => e.type === 'achievement-unlocked').map((e) => e.achievement.id)).toContain('streak-3');
  });

  it('unlocks time-of-day achievements from the validation time', async () => {
    deps.clock.set(at(24, 7, 30));
    await app.challenge.complete();
    deps.clock.set(at(25, 22, 15));
    await app.challenge.complete();
    const unlocked = snapshot?.achievements.filter((a) => a.unlockedOn).map((a) => a.id);
    expect(unlocked).toEqual(expect.arrayContaining(['early-bird', 'night-owl']));
  });

  it('redraws an unread card that falls outside a new range, and keeps one inside it', async () => {
    await app.challenge.open(); // 40 pages
    const inside = await app.range.update({ min: 20, max: 60, step: 20 });
    expect(inside.ok && inside.value.todayRedrawn).toBe(false);
    const outside = await app.range.update({ min: 100, max: 200, step: 50 });
    expect(outside.ok && outside.value.todayRedrawn).toBe(true);
    expect([100, 150, 200]).toContain(snapshot?.today.pages);
  });

  it('never redraws a card already read', async () => {
    await app.challenge.complete();
    const result = await app.range.update({ min: 100, max: 200, step: 50 });
    expect(result.ok && result.value.todayRedrawn).toBe(false);
    expect(snapshot?.today.pages).toBe(40);
  });

  it('validates and saves the profile, stamping reader-since', async () => {
    const bad = await app.profile.save({ displayName: '  ', avatar: '🦉', favouriteGenre: '' });
    expect(bad.ok).toBe(false);
    const good = await app.profile.save({ displayName: ' Ada ', avatar: '🦉', favouriteGenre: 'SF' });
    expect(good).toMatchObject({ ok: true, value: { displayName: 'Ada', readerSince: '2026-11-24' } });
    expect(snapshot?.achievements.find((a) => a.id === 'introductions')?.unlockedOn).toBe('2026-11-24');
  });
});

describe('the bookshelf', () => {
  it('puts a book in hand, shelves it when finished, and counts books read', async () => {
    const deps = inMemoryDeps(at(20));
    const app = createReadingApp(deps);
    const events: ReadingEvent[] = [];
    app.view.onEvent((e) => events.push(e));

    expect(await app.bookshelf.startReading({ title: '   ' })).toMatchObject({ ok: false });
    await app.bookshelf.startReading({ title: '  The   Dispossessed ' });
    expect(app.view.current()?.shelf.current).toEqual({ title: 'The Dispossessed', startedOn: '2026-11-20', bookmark: 0 });

    deps.clock.set(at(24));
    const finished = await app.bookshelf.finishBook();
    const book = { title: 'The Dispossessed', startedOn: '2026-11-20', finishedOn: '2026-11-24' };
    expect(finished).toEqual({ ok: true, value: book });
    const snapshot = app.view.current();
    expect(snapshot?.shelf).toEqual({ current: null, finished: [book] });
    expect(snapshot?.stats.booksRead).toBe(1);
    expect(events.map((e) => e.type)).toEqual(['book-finished', 'achievement-unlocked']);
    expect(snapshot?.achievements.find((a) => a.id === 'book-1')?.unlockedOn).toBe('2026-11-24');
  });

  it('shelves a book with nothing in hand, named or not', async () => {
    const app = createReadingApp(inMemoryDeps(at(24)));
    expect(await app.bookshelf.finishBook()).toEqual({ ok: true, value: { title: null, finishedOn: '2026-11-24' } });
    expect(await app.bookshelf.finishBook({ title: ' Kindred ' })).toEqual({
      ok: true,
      value: { title: 'Kindred', finishedOn: '2026-11-24' },
    });
    expect(app.view.current()?.stats.booksRead).toBe(2);
  });

  it('awards a shelf of your own at five books', async () => {
    const app = createReadingApp(inMemoryDeps(at(24)));
    for (const title of ['A', 'B', 'C', 'D', 'E']) {
      await app.bookshelf.startReading({ title });
      await app.bookshelf.finishBook();
    }
    expect(app.view.current()?.achievements.find((a) => a.id === 'books-5')?.unlockedOn).toBe('2026-11-24');
  });

  it('reads a shelf saved before books carried a start date', async () => {
    const deps = inMemoryDeps(at(24));
    deps.shelves.shelf = { current: 'Middlemarch' as never, finished: [{ title: 'Persuasion', finishedOn: '2026-11-01' }] };
    const app = createReadingApp(deps);
    await app.challenge.open();
    expect(app.view.current()?.shelf.current).toEqual({ title: 'Middlemarch', startedOn: '2026-11-24' });
  });

  it('refuses a field problem with a code the UI can word', async () => {
    const app = createReadingApp(inMemoryDeps(at(24)));
    expect(await app.bookshelf.startReading({ title: 'x'.repeat(121) })).toEqual({
      ok: false,
      error: [{ field: 'title', problem: 'too-long', max: 120 }],
    });
  });
});

describe('the bookmark', () => {
  it('starts where the reader is, and shows the page the day leads to', async () => {
    const app = createReadingApp(inMemoryDeps(at(24), [0.35])); // goal: 40
    await app.bookshelf.startReading({ title: 'Middlemarch', bookmark: 112, totalPages: 880 });
    expect(app.view.current()?.shelf.current).toMatchObject({ bookmark: 112, totalPages: 880 });
    expect(app.view.current()?.readTo).toBe(152);
  });

  it('starts at the beginning when the reader does not say', async () => {
    const app = createReadingApp(inMemoryDeps(at(24), [0.35]));
    await app.bookshelf.startReading({ title: 'Kindred' });
    expect(app.view.current()?.readTo).toBe(40);
  });

  it('moves on by the pages logged, and by pages added later', async () => {
    const deps = inMemoryDeps(at(24), [0.35]);
    const app = createReadingApp(deps);
    await app.bookshelf.startReading({ title: 'Middlemarch', bookmark: 112 });
    await app.challenge.complete({ pagesRead: 30 });
    expect(app.view.current()?.shelf.current?.bookmark).toBe(142);
    expect(app.view.current()?.readTo).toBeNull(); // the day is read
    await app.challenge.addPages(8);
    expect(app.view.current()?.shelf.current?.bookmark).toBe(150);

    deps.clock.set(at(25)); // a new card: 40 pages again, from page 150
    await app.challenge.open();
    expect(app.view.current()?.readTo).toBe(190);
  });

  it('stops at the last page', async () => {
    const app = createReadingApp(inMemoryDeps(at(24), [0.35]));
    await app.bookshelf.startReading({ title: 'Piranesi', bookmark: 230, totalPages: 245 });
    expect(app.view.current()?.readTo).toBe(245);
    await app.challenge.complete();
    expect(app.view.current()?.shelf.current?.bookmark).toBe(245);
  });

  it('can be moved by hand, and the book given or stripped of a length', async () => {
    const app = createReadingApp(inMemoryDeps(at(24), [0.35]));
    expect(await app.bookshelf.updateBook({ bookmark: 3 })).toEqual({
      ok: false,
      error: [{ field: 'bookmark', problem: 'no-book' }],
    });
    await app.bookshelf.startReading({ title: 'Middlemarch' });
    await app.bookshelf.updateBook({ bookmark: 200, totalPages: 880 });
    expect(app.view.current()?.shelf.current).toMatchObject({ bookmark: 200, totalPages: 880 });
    expect(await app.bookshelf.updateBook({ totalPages: 150 })).toEqual({
      ok: false,
      error: [{ field: 'bookmark', problem: 'past-the-end', max: 150 }],
    });
    expect(await app.bookshelf.updateBook({ bookmark: -1 })).toMatchObject({
      ok: false,
      error: [{ field: 'bookmark', problem: 'out-of-range' }],
    });
    await app.bookshelf.updateBook({ totalPages: null });
    expect(app.view.current()?.shelf.current).toEqual({ title: 'Middlemarch', startedOn: '2026-11-24', bookmark: 200 });
  });

  it('is placed in a book from before bookmarks existed, which until then stays unmarked', async () => {
    const deps = inMemoryDeps(at(24), [0.35]);
    deps.shelves.shelf = { current: { title: 'Middlemarch', startedOn: '2026-11-01' }, finished: [] };
    const app = createReadingApp(deps);
    await app.challenge.complete();
    expect(app.view.current()?.shelf.current).toEqual({ title: 'Middlemarch', startedOn: '2026-11-01' });
    await app.bookshelf.updateBook({ bookmark: 300 });
    expect(app.view.current()?.shelf.current?.bookmark).toBe(300);
  });

  it('goes on the shelf with the book', async () => {
    const app = createReadingApp(inMemoryDeps(at(24), [0.35]));
    await app.bookshelf.startReading({ title: 'Piranesi', bookmark: 230, totalPages: 245 });
    await app.challenge.complete({ pagesRead: 15, finishedBook: true });
    expect(app.view.current()?.shelf).toEqual({
      current: null,
      finished: [{ title: 'Piranesi', startedOn: '2026-11-24', finishedOn: '2026-11-24' }],
    });
  });
});

describe('the language', () => {
  it('follows the device by default, English when the device speaks nothing the app does', async () => {
    const deps = inMemoryDeps(at(24));
    deps.languages.tags = ['de-DE', 'fr-CA', 'en'];
    const app = createReadingApp(deps);
    await app.challenge.open();
    expect(app.view.current()?.language).toEqual({ choice: 'auto', language: 'fr', locale: 'fr-CA' });
    deps.languages.tags = ['de-DE'];
    await app.challenge.open();
    expect(app.view.current()?.language).toEqual({ choice: 'auto', language: 'en', locale: 'en' });
  });

  it('keeps the reader’s pick, and goes back to the device on asking', async () => {
    const deps = inMemoryDeps(at(24));
    const app = createReadingApp(deps); // device: en-GB
    expect(await app.language.choose('fr')).toEqual({ ok: true, value: { choice: 'fr', language: 'fr', locale: 'fr' } });
    expect(deps.preferences.language).toBe('fr');
    expect(app.view.current()?.language.language).toBe('fr');
    await app.language.choose('auto');
    expect(app.view.current()?.language).toEqual({ choice: 'auto', language: 'en', locale: 'en-GB' });
    expect(await app.language.choose('de' as never)).toEqual({ ok: false, error: 'unsupported-language' });
  });
});

describe('logging what was actually read', () => {
  const unlocked = (app: ReturnType<typeof createReadingApp>) =>
    app.view.current()?.achievements.filter((a) => a.unlockedOn).map((a) => a.id) ?? [];

  it('logs the goal with one tap', async () => {
    const app = createReadingApp(inMemoryDeps(at(24), [0.35]));
    const result = await app.challenge.complete();
    expect(result).toMatchObject({ ok: true, value: { pagesRead: 40, goalMet: true, finishedBook: false } });
  });

  it('logs more than the goal, and rewards it', async () => {
    const app = createReadingApp(inMemoryDeps(at(24), [0.35])); // goal: 40
    await app.challenge.complete({ pagesRead: 85 });
    expect(app.view.current()?.stats).toMatchObject({ totalPages: 85, extraPages: 45, currentStreak: 1 });
    expect(unlocked(app)).toEqual(expect.arrayContaining(['beyond-goal', 'double-goal']));
    expect(unlocked(app)).not.toContain('extra-100');
  });

  it('logs fewer pages: the streak holds, the goal is not met, and that is encouraged', async () => {
    const app = createReadingApp(inMemoryDeps(at(24), [0.35]));
    await app.challenge.complete({ pagesRead: 12 });
    expect(app.view.current()?.today).toMatchObject({ status: 'completed', pagesRead: 12, goalMet: false });
    expect(app.view.current()?.stats).toMatchObject({ totalPages: 12, currentStreak: 1 });
    expect(unlocked(app)).toContain('little-by-little');
  });

  it('meets the goal by finishing a book, even short of the pages', async () => {
    const deps = inMemoryDeps(at(24), [0.35]);
    const app = createReadingApp(deps);
    await app.bookshelf.startReading({ title: 'Piranesi' });
    const events: ReadingEvent[] = [];
    app.view.onEvent((e) => events.push(e));
    await app.challenge.complete({ pagesRead: 18, finishedBook: true });
    expect(app.view.current()?.today).toMatchObject({ pagesRead: 18, goalMet: true, finishedBook: true });
    expect(app.view.current()?.shelf.finished.map((b) => b.title)).toEqual(['Piranesi']);
    expect(events.map((e) => e.type).slice(0, 2)).toEqual(['challenge-completed', 'book-finished']);
    expect(unlocked(app)).toEqual(expect.arrayContaining(['final-chapter', 'book-1']));
    expect(unlocked(app)).not.toContain('little-by-little');
  });

  it('finishes an unnamed book from the card, or names it there', async () => {
    const app = createReadingApp(inMemoryDeps(at(24)));
    await app.challenge.complete({ finishedBook: true, bookTitle: 'Jane Eyre' });
    expect(app.view.current()?.shelf.finished).toEqual([{ title: 'Jane Eyre', finishedOn: '2026-11-24' }]);
  });

  it('adds pages later the same day — only ever upward', async () => {
    const app = createReadingApp(inMemoryDeps(at(24), [0.35]));
    expect(await app.challenge.addPages(10)).toEqual({ ok: false, error: 'not-completed' });
    await app.challenge.complete({ pagesRead: 30 });
    expect(await app.challenge.addPages(0)).toEqual({ ok: false, error: 'invalid-pages' });
    const result = await app.challenge.addPages(25);
    expect(result).toMatchObject({ ok: true, value: { pagesRead: 55, goalMet: true } });
    expect(app.view.current()?.stats.totalPages).toBe(55);
    expect(unlocked(app)).toContain('beyond-goal');
  });

  it('rejects impossible counts', async () => {
    const app = createReadingApp(inMemoryDeps(at(24)));
    expect(await app.challenge.complete({ pagesRead: 0 })).toEqual({ ok: false, error: 'invalid-pages' });
    expect(await app.challenge.complete({ pagesRead: 12.5 })).toEqual({ ok: false, error: 'invalid-pages' });
    expect(await app.challenge.complete({ finishedBook: true, bookTitle: 'x'.repeat(200) })).toEqual({
      ok: false,
      error: 'invalid-title',
    });
  });

  it('counts days logged before page counts existed as their goal, met', async () => {
    const deps = inMemoryDeps(at(24));
    await deps.history.save({ day: '2026-11-23', pages: 60, artSeed: 1, status: 'completed', drawnAt: '', completedAt: '' });
    const app = createReadingApp(deps);
    await app.challenge.open();
    expect(app.view.current()?.stats).toMatchObject({ totalPages: 60, extraPages: 0, currentStreak: 1 });
  });
});

describe('reminders', () => {
  it('refuses to enable without notification permission', async () => {
    const deps = inMemoryDeps(at(24));
    deps.scheduler.permission = 'denied';
    const app = createReadingApp(deps);
    expect(await app.reminder.configure({ enabled: true, time: '20:00' })).toEqual({
      ok: false,
      error: 'permission-denied',
    });
    expect(await app.reminder.configure({ enabled: true, time: '25:00' })).toEqual({ ok: false, error: 'invalid-time' });
  });

  it('notifies once, after the reminder time, only while the day is unread', async () => {
    const deps = inMemoryDeps(at(24, 19, 0), [0.35]);
    const app = createReadingApp(deps);
    const configured = await app.reminder.configure({ enabled: true, time: '20:00' });
    expect(configured).toMatchObject({ ok: true, value: { delivery: 'background' } });

    expect(await app.reminderCheck.run()).toBe('not-yet');
    deps.clock.set(at(24, 20, 5));
    expect(await app.reminderCheck.run()).toBe('notified');
    expect(deps.notifier.sent[0]?.body).toContain('40 pages');
    expect(await app.reminderCheck.run()).toBe('already-notified');

    deps.clock.set(at(25, 20, 30));
    await app.challenge.complete();
    expect(await app.reminderCheck.run()).toBe('already-read');
    expect(deps.notifier.sent).toHaveLength(1);
  });

  it('schedules the next check today while ahead, tomorrow once past', async () => {
    const deps = inMemoryDeps(at(24, 19, 0));
    const app = createReadingApp(deps);
    expect(await app.reminder.nextCheckAt()).toBeNull();
    await app.reminder.configure({ enabled: true, time: '20:00' });
    expect(await app.reminder.nextCheckAt()).toEqual(at(24, 20, 0));
    deps.clock.set(at(24, 21, 0));
    expect(await app.reminder.nextCheckAt()).toEqual(at(25, 20, 0));
  });

  it('speaks the reader’s language, and points to the page the day leads to', async () => {
    const deps = inMemoryDeps(at(24, 20, 5), [0.35]);
    const app = createReadingApp(deps);
    await app.reminder.configure({ enabled: true, time: '20:00' });
    await app.bookshelf.startReading({ title: 'Middlemarch', bookmark: 112 });
    await app.language.choose('fr');
    expect(await app.reminderCheck.run()).toBe('notified');
    expect(deps.notifier.sent[0]).toMatchObject({
      title: 'Combien de pages aujourd’hui\u202f?',
      body: 'Votre carte du jour\u00a0: 40 pages, jusqu’à la page 152. Une carte toute neuve vous attend 📖',
    });
  });

  it('reports a notification the platform refused to show', async () => {
    const deps = inMemoryDeps(at(24));
    deps.notifier.notify = async () => {
      throw new Error('No notification permission has been granted for this origin.');
    };
    const app = createReadingApp(deps);
    expect(await app.reminder.sendTest()).toEqual({ ok: false, error: 'delivery-failed' });
  });

  it('re-arms today when the reminder time moves', async () => {
    const deps = inMemoryDeps(at(24, 20, 30));
    const app = createReadingApp(deps);
    await app.reminder.configure({ enabled: true, time: '20:00' });
    expect(await app.reminderCheck.run()).toBe('notified');
    await app.reminder.configure({ enabled: true, time: '20:15' });
    expect(await app.reminderCheck.run()).toBe('notified');
  });
});

describe('the overview port', () => {
  it('looks back over what the app recorded', async () => {
    const deps = inMemoryDeps(at(24), [0.35]);
    const app = createReadingApp(deps);
    await app.challenge.complete({ pagesRead: 55, finishedBook: true, bookTitle: 'Kindred' });
    const month = await app.overview.month(2026, 11);
    expect(month.totals).toMatchObject({ pagesRead: 55, daysRead: 1, booksFinished: 1 });
    expect(month.books.map((b) => b.title)).toEqual(['Kindred']);
    expect((await app.overview.year(2026)).months[10]?.totals.pagesRead).toBe(55);
  });
});

describe('the welcome', () => {
  it('is needed on a first visit only, and not again once finished or skipped', async () => {
    const deps = inMemoryDeps(at(24));
    const app = createReadingApp(deps);
    expect(await app.welcome.needed()).toBe(true);
    await app.welcome.finish();
    expect(await app.welcome.needed()).toBe(false);
    expect(deps.preferences.welcome).toEqual({ completedOn: '2026-11-24' });
  });

  it('is not imposed on a reader who already has a card', async () => {
    const app = createReadingApp(inMemoryDeps(at(24)));
    await app.profile.save({ displayName: 'Ada', avatar: '🦉', favouriteGenre: '' });
    expect(await app.welcome.needed()).toBe(false);
  });

  it('can be asked for again', async () => {
    const app = createReadingApp(inMemoryDeps(at(24)));
    const events: ReadingEvent[] = [];
    app.view.onEvent((e) => events.push(e));
    await app.welcome.replay();
    expect(events).toEqual([{ type: 'welcome-requested' }]);
  });

  it('offers installation through the platform', async () => {
    const deps = inMemoryDeps(at(24));
    const app = createReadingApp(deps);
    expect(await app.welcome.installAvailability()).toBe('prompt');
    expect(await app.welcome.install()).toBe('accepted');
    expect(deps.installer.prompted).toBe(1);
  });
});
