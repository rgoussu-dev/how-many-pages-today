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
    const deps = inMemoryDeps(at(24));
    const app = createReadingApp(deps);
    const events: ReadingEvent[] = [];
    app.view.onEvent((e) => events.push(e));

    expect(await app.bookshelf.finishCurrent()).toEqual({ ok: false, error: 'nothing-in-progress' });
    expect(await app.bookshelf.startReading('   ')).toMatchObject({ ok: false });
    await app.bookshelf.startReading('  The   Dispossessed ');
    expect(app.view.current()?.shelf.current).toBe('The Dispossessed');

    const finished = await app.bookshelf.finishCurrent();
    expect(finished).toEqual({ ok: true, value: { title: 'The Dispossessed', finishedOn: '2026-11-24' } });
    const snapshot = app.view.current();
    expect(snapshot?.shelf).toEqual({ current: null, finished: [{ title: 'The Dispossessed', finishedOn: '2026-11-24' }] });
    expect(snapshot?.stats.booksRead).toBe(1);
    expect(events.map((e) => e.type)).toEqual(['book-finished', 'achievement-unlocked']);
    expect(snapshot?.achievements.find((a) => a.id === 'book-1')?.unlockedOn).toBe('2026-11-24');
  });

  it('awards a shelf of your own at five books', async () => {
    const app = createReadingApp(inMemoryDeps(at(24)));
    for (const title of ['A', 'B', 'C', 'D', 'E']) {
      await app.bookshelf.startReading(title);
      await app.bookshelf.finishCurrent();
    }
    expect(app.view.current()?.achievements.find((a) => a.id === 'books-5')?.unlockedOn).toBe('2026-11-24');
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
