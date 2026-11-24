import { describe, expect, it } from 'vitest';
import type { Bookshelf, DailyChallenge } from '@hmpt/domain-contract';
import { monthOverview, yearOverview } from './overview';

const day = (key: string, goal: number, pagesRead?: number, extra: Partial<DailyChallenge> = {}): DailyChallenge => ({
  day: key,
  pages: goal,
  artSeed: 1,
  status: pagesRead === undefined ? 'pending' : 'completed',
  drawnAt: '',
  ...(pagesRead === undefined ? {} : { pagesRead, goalMet: pagesRead >= goal, completedAt: '' }),
  ...extra,
});

const history: DailyChallenge[] = [
  day('2026-10-30', 40, 40),
  day('2026-10-31', 40, 10),
  day('2026-11-01', 30, 45),
  day('2026-11-02', 50, 20, { finishedBook: true, goalMet: true }),
  day('2026-11-03', 60), // dealt, not read
  day('2026-11-05', 20, 20),
  day('2026-11-06', 10, 80),
  day('2026-11-07', 30, 30),
];

const shelf: Bookshelf = {
  current: null,
  finished: [
    { title: 'Persuasion', finishedOn: '2026-10-12' },
    { title: 'Piranesi', startedOn: '2026-10-20', finishedOn: '2026-11-02' },
    { title: null, finishedOn: '2026-11-20' },
  ],
};

describe('the month overview', () => {
  const november = monthOverview(history, shelf, 2026, 11, '2026-11-24');

  it('adds up the month', () => {
    expect(november.totals).toEqual({ pagesRead: 195, daysRead: 5, goalsMet: 5, booksFinished: 2, extraPages: 85 });
    expect(november.previous).toEqual({ pagesRead: 50, daysRead: 2, goalsMet: 1, booksFinished: 1, extraPages: 0 });
  });

  it('lists every day of the month, read or not', () => {
    expect(november.days).toHaveLength(30);
    expect(november.days[0]).toEqual({ day: '2026-11-01', goal: 30, pagesRead: 45, goalMet: true, finishedBook: false });
    expect(november.days[2]).toEqual({ day: '2026-11-03', goal: 60, pagesRead: 0, goalMet: false, finishedBook: false });
    expect(november.days[3]).toMatchObject({ goal: null, pagesRead: 0 });
    expect(november.days[19]).toMatchObject({ day: '2026-11-20', finishedBook: true }); // shelved, no card
  });

  it('finds the best day, the books, and the longest run of reading days', () => {
    expect(november.bestDay?.day).toBe('2026-11-06');
    expect(november.books.map((b) => b.title)).toEqual(['Piranesi', null]);
    expect(november.longestStreak).toBe(3); // 5, 6, 7 November
  });

  it('knows where looking back and forward stops', () => {
    expect(november).toMatchObject({ hasEarlier: true, hasLater: false });
    expect(monthOverview(history, shelf, 2026, 10, '2026-11-24')).toMatchObject({ hasEarlier: false, hasLater: true });
  });

  it('handles February and an empty month', () => {
    const february = monthOverview([], { current: null, finished: [] }, 2028, 2, '2028-02-10');
    expect(february.days).toHaveLength(29);
    expect(february.bestDay).toBeNull();
    expect(february.totals.pagesRead).toBe(0);
  });
});

describe('the year overview', () => {
  const year = yearOverview(history, shelf, 2026, '2026-11-24');

  it('adds up the year and each month', () => {
    expect(year.totals).toMatchObject({ pagesRead: 245, daysRead: 7, booksFinished: 3 });
    expect(year.months).toHaveLength(12);
    expect(year.months[9]?.totals).toMatchObject({ pagesRead: 50, booksFinished: 1 });
    expect(year.months[10]?.totals).toMatchObject({ pagesRead: 195, booksFinished: 2 });
    expect(year.bestMonth?.month).toBe(11);
  });

  it('runs streaks across month ends', () => {
    expect(year.longestStreak).toBe(4); // 30 Oct – 2 Nov
  });

  it('compares with the year before', () => {
    expect(year.previous.pagesRead).toBe(0);
    expect(year).toMatchObject({ hasEarlier: false, hasLater: false });
  });
});
