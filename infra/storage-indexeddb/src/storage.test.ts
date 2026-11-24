import { afterEach, describe, expect, it } from 'vitest';
import type { DailyChallenge } from '@hmpt/domain-contract';
import { openReadingDatabase, type ReadingStorage } from './storage';

const card = (day: string, pages: number): DailyChallenge => ({
  day,
  pages,
  artSeed: 7,
  status: 'pending',
  drawnAt: `${day}T08:00:00.000Z`,
});

let opened: ReadingStorage[] = [];
const open = async (name: string) => {
  const storage = await openReadingDatabase(name);
  opened.push(storage);
  return storage;
};
afterEach(() => {
  opened.forEach((s) => s.close());
  opened = [];
});

describe('IndexedDB storage', () => {
  it('keeps the first card drawn for a day, whichever context draws second', async () => {
    const page = await open('race');
    const worker = await open('race'); // a second connection, as the service worker has
    const [a, b] = await Promise.all([
      page.history.createIfAbsent(card('2026-11-24', 40)),
      worker.history.createIfAbsent(card('2026-11-24', 90)),
    ]);
    expect(a).toEqual(b);
    expect(await page.history.all()).toHaveLength(1);
  });

  it('round-trips challenges, profile and preferences', async () => {
    const storage = await open('round-trip');
    await storage.history.save({ ...card('2026-11-24', 30), status: 'completed', completedAt: '2026-11-24T19:00:00.000Z' });
    await storage.profiles.save({ displayName: 'Ada', avatar: '🦉', favouriteGenre: '', readerSince: '2026-11-24' });
    await storage.shelves.save({
      current: { title: 'Middlemarch', startedOn: '2026-11-21' },
      finished: [{ title: 'Persuasion', startedOn: '2026-11-02', finishedOn: '2026-11-20' }, { title: null, finishedOn: '2026-11-22' }],
    });
    await storage.preferences.saveRange({ min: 5, max: 50, step: 5 });
    await storage.preferences.saveReminder({ enabled: true, time: '21:30' });

    const reopened = await open('round-trip');
    expect(await reopened.history.byDay('2026-11-24')).toMatchObject({ status: 'completed', pages: 30 });
    expect((await reopened.profiles.load())?.displayName).toBe('Ada');
    expect((await reopened.shelves.load())?.finished).toEqual([
      { title: 'Persuasion', startedOn: '2026-11-02', finishedOn: '2026-11-20' },
      { title: null, finishedOn: '2026-11-22' },
    ]);
    expect(await reopened.preferences.loadRange()).toEqual({ min: 5, max: 50, step: 5 });
    expect(await reopened.preferences.loadReminder()).toEqual({ enabled: true, time: '21:30' });
  });

  it('never overwrites the first unlock date of an achievement', async () => {
    const storage = await open('ledger');
    await storage.achievements.record([{ id: 'first-challenge', unlockedOn: '2026-11-01' }]);
    await storage.achievements.record([
      { id: 'first-challenge', unlockedOn: '2026-11-24' },
      { id: 'streak-3', unlockedOn: '2026-11-24' },
    ]);
    const all = await storage.achievements.all();
    expect(all).toHaveLength(2);
    expect(all.find((a) => a.id === 'first-challenge')?.unlockedOn).toBe('2026-11-01');
  });
});
