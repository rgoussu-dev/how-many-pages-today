import type { Achievement, DailyChallenge, FinishedBook } from './model';

/** Domain events cross the contract face as plain objects; the UI decides how to celebrate. */
export type ReadingEvent =
  | { readonly type: 'challenge-completed'; readonly challenge: DailyChallenge; readonly streak: number }
  | { readonly type: 'pages-added'; readonly challenge: DailyChallenge; readonly added: number }
  | { readonly type: 'book-finished'; readonly book: FinishedBook; readonly booksRead: number }
  | { readonly type: 'achievement-unlocked'; readonly achievement: Achievement }
  | { readonly type: 'welcome-requested' };
