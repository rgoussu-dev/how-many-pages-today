import type { Achievement, DailyChallenge } from './model';

/** Domain events cross the contract face as plain objects; the UI decides how to celebrate. */
export type ReadingEvent =
  | { readonly type: 'challenge-completed'; readonly challenge: DailyChallenge; readonly streak: number }
  | { readonly type: 'challenge-undone'; readonly challenge: DailyChallenge }
  | { readonly type: 'achievement-unlocked'; readonly achievement: Achievement };
