import { describe, expect, it } from 'vitest';
import { bestStreak, currentStreak, levelFor } from './stats';
import { addDays, dayKeyOf, daysBetween, weekdayOf } from './days';

describe('days', () => {
  it('does calendar arithmetic across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-24', '2026-11-24')).toBe(31);
  });

  it('survives a DST change (Europe moves clocks on 2026-10-25)', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('formats the local day of an instant', () => {
    expect(dayKeyOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('knows the weekday', () => {
    expect(weekdayOf('2026-11-28')).toBe(6); // a Saturday
  });
});

describe('streaks', () => {
  const days = new Set(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']);

  it('keeps the streak alive while today is still unread', () => {
    expect(currentStreak(days, '2026-11-24')).toBe(4);
  });

  it('counts today once it is read', () => {
    expect(currentStreak(new Set([...days, '2026-11-24']), '2026-11-24')).toBe(5);
  });

  it('breaks after a whole missed day', () => {
    expect(currentStreak(days, '2026-11-25')).toBe(0);
  });

  it('remembers the best run', () => {
    expect(bestStreak(new Set(['2026-11-01', '2026-11-02', '2026-11-05', ...days]))).toBe(4);
    expect(bestStreak(new Set())).toBe(0);
  });
});

describe('levels', () => {
  it('starts at rank 1 and tracks progress to the next rank', () => {
    expect(levelFor(0)).toEqual({ rank: 1, pagesIntoLevel: 0, pagesForLevel: 100 });
    expect(levelFor(350)).toMatchObject({ rank: 3, pagesIntoLevel: 50, pagesForLevel: 300 });
  });

  it('caps at the top rank', () => {
    expect(levelFor(25_000)).toMatchObject({ rank: 10, pagesForLevel: null });
  });
});
