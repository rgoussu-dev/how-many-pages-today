import type { DailyChallenge, DayKey, ReaderLevel, ReadingStats } from '@hmpt/domain-contract';
import { addDays, daysBetween } from './days';

export const completedOnly = (history: readonly DailyChallenge[]): DailyChallenge[] =>
  history.filter((c) => c.status === 'completed');

/** Pages actually read. Days logged before counts existed read exactly their goal. */
export const pagesReadOf = (c: DailyChallenge): number => c.pagesRead ?? c.pages;

/** Whether the day met its goal. Days logged before this was recorded met it in full. */
export const goalMetOf = (c: DailyChallenge): boolean => c.goalMet ?? pagesReadOf(c) >= c.pages;

export const extraPagesOf = (c: DailyChallenge): number => Math.max(0, pagesReadOf(c) - c.pages);

/**
 * The streak still alive today: it ends today when today is read, otherwise it ends
 * yesterday — an unread today does not break a streak until the day is over.
 */
export function currentStreak(completedDays: ReadonlySet<DayKey>, today: DayKey): number {
  let day = completedDays.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (completedDays.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export function bestStreak(completedDays: ReadonlySet<DayKey>): number {
  const days = [...completedDays].sort();
  let best = 0;
  let run = 0;
  let previous: DayKey | undefined;
  for (const day of days) {
    run = previous !== undefined && daysBetween(previous, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** Cumulative pages needed to reach each rank. */
const LEVELS: readonly { readonly from: number; readonly title: string }[] = [
  { from: 0, title: 'Page turner' },
  { from: 100, title: 'Apprentice reader' },
  { from: 300, title: 'Bookish' },
  { from: 600, title: 'Avid reader' },
  { from: 1000, title: 'Bibliophile' },
  { from: 1500, title: 'Scholar' },
  { from: 2500, title: 'Sage' },
  { from: 4000, title: 'Librarian' },
  { from: 6000, title: 'Archivist' },
  { from: 10000, title: 'Living legend' },
];

export function levelFor(totalPages: number): ReaderLevel {
  let index = 0;
  LEVELS.forEach((level, i) => {
    if (totalPages >= level.from) index = i;
  });
  const level = LEVELS[index]!;
  const next = LEVELS[index + 1];
  return {
    rank: index + 1,
    title: level.title,
    pagesIntoLevel: totalPages - level.from,
    pagesForLevel: next ? next.from - level.from : null,
  };
}

export function computeStats(history: readonly DailyChallenge[], today: DayKey, booksRead = 0): ReadingStats {
  const completed = completedOnly(history);
  const days = new Set(completed.map((c) => c.day));
  const totalPages = completed.reduce((sum, c) => sum + pagesReadOf(c), 0);
  const extraPages = completed.reduce((sum, c) => sum + extraPagesOf(c), 0);
  return {
    currentStreak: currentStreak(days, today),
    bestStreak: bestStreak(days),
    totalPages,
    extraPages,
    completedCount: completed.length,
    booksRead,
    level: levelFor(totalPages),
  };
}
