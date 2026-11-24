import type { DayKey, FinishedBook } from './model';

/** What a span of time adds up to. */
export interface PeriodTotals {
  readonly pagesRead: number;
  readonly daysRead: number;
  readonly goalsMet: number;
  readonly booksFinished: number;
  /** Pages read beyond the day's goal. */
  readonly extraPages: number;
}

export interface OverviewDay {
  readonly day: DayKey;
  /** The day's goal, or null when no card was dealt that day. */
  readonly goal: number | null;
  readonly pagesRead: number;
  readonly goalMet: boolean;
  readonly finishedBook: boolean;
}

export interface MonthOverview {
  readonly year: number;
  /** 1 – 12. */
  readonly month: number;
  readonly totals: PeriodTotals;
  /** The month before, for comparison. */
  readonly previous: PeriodTotals;
  /** Every day of the month, in order. */
  readonly days: readonly OverviewDay[];
  /** Finished this month, in the order they were finished. */
  readonly books: readonly FinishedBook[];
  readonly bestDay: OverviewDay | null;
  /** Longest run of consecutive reading days inside the month. */
  readonly longestStreak: number;
  /** Whether there is anything to look back on before / after this month. */
  readonly hasEarlier: boolean;
  readonly hasLater: boolean;
}

export interface OverviewMonth {
  readonly month: number;
  readonly totals: PeriodTotals;
}

export interface YearOverview {
  readonly year: number;
  readonly totals: PeriodTotals;
  readonly previous: PeriodTotals;
  /** January to December. */
  readonly months: readonly OverviewMonth[];
  readonly books: readonly FinishedBook[];
  readonly bestMonth: OverviewMonth | null;
  readonly longestStreak: number;
  readonly hasEarlier: boolean;
  readonly hasLater: boolean;
}

/** Reading looked back on, month by month and year by year. */
export interface OverviewPort {
  month(year: number, month: number): Promise<MonthOverview>;
  year(year: number): Promise<YearOverview>;
}
