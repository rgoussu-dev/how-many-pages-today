/** A local calendar day, `YYYY-MM-DD`, in the reader's own timezone. */
export type DayKey = string;

/** The bounds the daily page count is drawn from: min, min+step, … up to max. */
export interface PageRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export const DEFAULT_PAGE_RANGE: PageRange = { min: 10, max: 100, step: 10 };

/** Hard limits on what a reader may configure. */
export const PAGE_RANGE_LIMITS = { lowest: 1, highest: 1000 } as const;

/** `completed` once any reading is logged for the day — every page counts toward the streak. */
export type ChallengeStatus = 'pending' | 'completed';

/** One card: the challenge drawn for a given day, and what was actually read. */
export interface DailyChallenge {
  readonly day: DayKey;
  /** The goal drawn for the day. */
  readonly pages: number;
  /** Seeds the card illustration; drawn once with the challenge so the card never changes. */
  readonly artSeed: number;
  readonly status: ChallengeStatus;
  /** ISO-8601 instant. */
  readonly drawnAt: string;
  /** ISO-8601 instant the reader first opened the card — the little ceremony plays until then. */
  readonly unveiledAt?: string;
  /** ISO-8601 instant of the first log, present once completed. */
  readonly completedAt?: string;
  /** Pages actually read that day — more or fewer than the goal. Present once completed. */
  readonly pagesRead?: number;
  /** A book was finished that day. */
  readonly finishedBook?: boolean;
  /** At least the goal was read, or a book was finished. Present once completed. */
  readonly goalMet?: boolean;
}

/** Limits on a single log entry. */
export const PAGES_READ_LIMITS = { lowest: 1, highest: 2000 } as const;

export const AVATARS = ['📚', '🦉', '🐛', '🦊', '🐢', '🐈', '🌙', '☕', '🌿', '🚀', '🧙', '🎩'] as const;

/** A deliberately small profile. It never leaves the device. */
export interface Profile {
  readonly displayName: string;
  readonly avatar: string;
  readonly favouriteGenre: string;
  readonly readerSince: DayKey;
}

export type ProfileInput = Omit<Profile, 'readerSince'>;

/** The book on the nightstand, and the bookmark in it. */
export interface BookInHand {
  readonly title: string;
  readonly startedOn: DayKey;
  /**
   * The page the reader has reached: 0 before the first page. Moves on with every page
   * logged. Absent on books put on the nightstand before the app kept a bookmark.
   */
  readonly bookmark?: number;
  /** How many pages the book has, when the reader said. */
  readonly totalPages?: number;
}

/** Limits on a bookmark and on a book's length. */
export const BOOK_PAGE_LIMITS = { highest: 20000 } as const;

/**
 * A finished book. The title is optional — finishing counts even unnamed. The dates are
 * kept so the shelf can later be read back month by month, year by year.
 */
export interface FinishedBook {
  readonly title: string | null;
  readonly startedOn?: DayKey;
  readonly finishedOn: DayKey;
}

/** The book in hand, and every book finished since — the reader's own shelf. */
export interface Bookshelf {
  readonly current: BookInHand | null;
  /** Oldest first, in the order they were finished. */
  readonly finished: readonly FinishedBook[];
}

export const EMPTY_SHELF: Bookshelf = { current: null, finished: [] };

export interface ReminderSettings {
  readonly enabled: boolean;
  /** `HH:MM`, 24-hour, local time. */
  readonly time: string;
  /** The last day a reminder notification was shown, so a day is never nagged twice. */
  readonly lastNotifiedOn?: DayKey;
}

/** How the reminder will reach the reader on this device. */
export type ReminderDelivery =
  /** The browser wakes the app in the background (periodic background sync). */
  | 'background'
  /** Notifications fire only while the app is open or recently backgrounded. */
  | 'while-open';

/** The first-visit walkthrough: whether it has been completed (or skipped). */
export interface WelcomeState {
  readonly completedOn?: DayKey;
}

/** How this app can be installed on this device. */
export type InstallAvailability =
  /** Already running as an installed app. */
  | 'installed'
  /** The browser offers an install prompt the app can trigger (Chromium). */
  | 'prompt'
  /** iOS / iPadOS Safari: Share → Add to Home Screen, by hand. */
  | 'ios'
  /** Some other browser: install from its own menu, if it can. */
  | 'manual';

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

/** The languages the app speaks. */
export const LANGUAGES = ['en', 'fr'] as const;
export type Language = (typeof LANGUAGES)[number];

/** What the reader picked: a language, or whatever the device prefers. */
export type LanguageChoice = 'auto' | Language;

export interface LanguageSetting {
  readonly choice: LanguageChoice;
  /** The language the app speaks now: the choice, or the device's best match (English by default). */
  readonly language: Language;
  /** A BCP 47 tag for dates and numbers: the device's own variant of `language` when it has one (`fr-CA`). */
  readonly locale: string;
}

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, time: '20:00' };

export type AchievementId =
  | 'first-challenge'
  | 'streak-3'
  | 'streak-7'
  | 'streak-30'
  | 'streak-100'
  | 'book-1'
  | 'books-5'
  | 'books-12'
  | 'pages-500'
  | 'pages-1000'
  | 'pages-5000'
  | 'marathon'
  | 'beyond-goal'
  | 'double-goal'
  | 'extra-100'
  | 'page-binge'
  | 'little-by-little'
  | 'final-chapter'
  | 'early-bird'
  | 'night-owl'
  | 'weekend'
  | 'comeback'
  | 'introductions';

/** A bookplate. Its name and wording belong to the UI's phrasebooks, keyed by `id`. */
export interface Achievement {
  readonly id: AchievementId;
  readonly icon: string;
}

export interface UnlockedAchievement {
  readonly id: AchievementId;
  readonly unlockedOn: DayKey;
}

export interface AchievementStatus extends Achievement {
  readonly unlockedOn?: DayKey;
}

/** The reader's rank, 1 – 10. Its title belongs to the UI's phrasebooks, keyed by `rank`. */
export interface ReaderLevel {
  readonly rank: number;
  /** Pages already read inside the current level. */
  readonly pagesIntoLevel: number;
  /** Pages the current level spans; null at the top level. */
  readonly pagesForLevel: number | null;
}

export interface ReadingStats {
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly totalPages: number;
  /** Pages read beyond the day's goal, summed over every day. */
  readonly extraPages: number;
  readonly completedCount: number;
  readonly booksRead: number;
  readonly level: ReaderLevel;
}

/** Everything the UI renders, recomputed after every change. */
export interface ReadingSnapshot {
  readonly today: DailyChallenge;
  /** Newest first. */
  readonly history: readonly DailyChallenge[];
  readonly profile: Profile | null;
  readonly shelf: Bookshelf;
  /**
   * The page today's reading leads to in the book in hand: its bookmark plus the day's goal,
   * at most its last page. Null once the day is read, or without a book or a bookmark.
   */
  readonly readTo: number | null;
  readonly range: PageRange;
  readonly reminder: ReminderSettings;
  readonly language: LanguageSetting;
  readonly stats: ReadingStats;
  readonly achievements: readonly AchievementStatus[];
}
