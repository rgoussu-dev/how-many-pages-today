import type {
  Bookshelf,
  DailyChallenge,
  DayKey,
  FinishedBook,
  MonthOverview,
  OverviewDay,
  OverviewMonth,
  PeriodTotals,
  YearOverview,
} from '@hmpt/domain-contract';
import { addDays, daysBetween } from './days';
import { extraPagesOf, goalMetOf, pagesReadOf } from './stats';

const pad = (n: number): string => String(n).padStart(2, '0');
const monthStart = (year: number, month: number): DayKey => `${year}-${pad(month)}-01`;
const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();
const monthEnd = (year: number, month: number): DayKey => `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`;
const previousMonth = (year: number, month: number): [number, number] => (month === 1 ? [year - 1, 12] : [year, month - 1]);

interface Span {
  readonly from: DayKey;
  readonly to: DayKey;
}

const within = (day: DayKey, { from, to }: Span): boolean => day >= from && day <= to;

const readDays = (history: readonly DailyChallenge[], span: Span): DailyChallenge[] =>
  history.filter((c) => c.status === 'completed' && within(c.day, span));

const booksIn = (shelf: Bookshelf, span: Span): FinishedBook[] => shelf.finished.filter((b) => within(b.finishedOn, span));

function totals(history: readonly DailyChallenge[], shelf: Bookshelf, span: Span): PeriodTotals {
  const read = readDays(history, span);
  return {
    pagesRead: read.reduce((sum, c) => sum + pagesReadOf(c), 0),
    daysRead: read.length,
    goalsMet: read.filter(goalMetOf).length,
    booksFinished: booksIn(shelf, span).length,
    extraPages: read.reduce((sum, c) => sum + extraPagesOf(c), 0),
  };
}

function longestRun(days: readonly DayKey[]): number {
  let best = 0;
  let run = 0;
  let previous: DayKey | undefined;
  for (const day of [...days].sort()) {
    run = previous !== undefined && daysBetween(previous, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** The first day anything was read or shelved — where looking back stops. */
function firstRecord(history: readonly DailyChallenge[], shelf: Bookshelf): DayKey | null {
  const days = [
    ...history.filter((c) => c.status === 'completed').map((c) => c.day),
    ...shelf.finished.map((b) => b.finishedOn),
  ].sort();
  return days[0] ?? null;
}

export function monthOverview(
  history: readonly DailyChallenge[],
  shelf: Bookshelf,
  year: number,
  month: number,
  today: DayKey,
): MonthOverview {
  const span = { from: monthStart(year, month), to: monthEnd(year, month) };
  const byDay = new Map(history.map((c) => [c.day, c]));
  const shelvedOn = new Set(shelf.finished.map((b) => b.finishedOn));
  const days: OverviewDay[] = [];
  for (let day = span.from; day <= span.to; day = addDays(day, 1)) {
    const card = byDay.get(day);
    const read = card?.status === 'completed';
    days.push({
      day,
      goal: card ? card.pages : null,
      pagesRead: read ? pagesReadOf(card) : 0,
      goalMet: read ? goalMetOf(card) : false,
      finishedBook: (read && card.finishedBook === true) || shelvedOn.has(day),
    });
  }
  const bestDay = days.reduce<OverviewDay | null>((best, d) => (d.pagesRead > (best?.pagesRead ?? 0) ? d : best), null);
  const [py, pm] = previousMonth(year, month);
  const first = firstRecord(history, shelf);
  return {
    year,
    month,
    totals: totals(history, shelf, span),
    previous: totals(history, shelf, { from: monthStart(py, pm), to: monthEnd(py, pm) }),
    days,
    books: booksIn(shelf, span),
    bestDay,
    longestStreak: longestRun(readDays(history, span).map((c) => c.day)),
    hasEarlier: first !== null && first < span.from,
    hasLater: today > span.to,
  };
}

export function yearOverview(
  history: readonly DailyChallenge[],
  shelf: Bookshelf,
  year: number,
  today: DayKey,
): YearOverview {
  const span = { from: `${year}-01-01`, to: `${year}-12-31` };
  const months: OverviewMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    totals: totals(history, shelf, { from: monthStart(year, i + 1), to: monthEnd(year, i + 1) }),
  }));
  const bestMonth = months.reduce<OverviewMonth | null>(
    (best, m) => (m.totals.pagesRead > (best?.totals.pagesRead ?? 0) ? m : best),
    null,
  );
  const first = firstRecord(history, shelf);
  return {
    year,
    totals: totals(history, shelf, span),
    previous: totals(history, shelf, { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }),
    months,
    books: booksIn(shelf, span),
    bestMonth,
    longestStreak: longestRun(readDays(history, span).map((c) => c.day)),
    hasEarlier: first !== null && first < span.from,
    hasLater: today > span.to,
  };
}
