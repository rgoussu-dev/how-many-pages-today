import type { Result } from '@hmpt/kernel';
import type {
  Bookshelf,
  DailyChallenge,
  FinishedBook,
  InstallAvailability,
  InstallOutcome,
  LanguageChoice,
  LanguageSetting,
  PageRange,
  Profile,
  ProfileInput,
  ReadingSnapshot,
  ReminderDelivery,
  ReminderSettings,
} from './model';
import type { ReadingEvent } from './events';

/**
 * Driving ports — one per use case. Custom elements receive them through typed context
 * keys and never see the implementation.
 */

export type ChallengeError =
  | 'already-completed'
  | 'not-completed'
  /** No book in hand, or one without a bookmark: there is no page to read on from. */
  | 'no-bookmark'
  /** Not a whole page number. */
  | 'invalid-page'
  /** At or before the bookmark: no page was read. */
  | 'not-past-bookmark'
  /** Past the book's last page. */
  | 'past-the-end'
  /** More pages in one sitting than `PAGES_READ_LIMITS` allows. */
  | 'too-many-pages';

/** Where the reading stopped, in the book in hand. The pages read are the pages from its bookmark. */
export interface ReadingLog {
  /** The page the reader stopped at: past the bookmark, at most the book's last page. */
  readonly stoppedAt: number;
  /** That was the book's last page. Implied when `stoppedAt` is its known last page. */
  readonly finishedBook?: boolean;
}

export interface DailyChallengePort {
  /** Draws today's card if it does not exist yet, then refreshes the read model. Idempotent. */
  open(): Promise<DailyChallenge>;
  /** The reader has opened today's card. Idempotent; the first opening is kept. */
  unveil(): Promise<DailyChallenge>;
  /** Logs today's reading, up to the page the reader stopped at. Final — a day read stays read. */
  complete(log: ReadingLog): Promise<Result<DailyChallenge, ChallengeError>>;
  /** Logs reading on, later the same day, to a page further still. Only ever upward. */
  readOn(log: ReadingLog): Promise<Result<DailyChallenge, ChallengeError>>;
}

/** What is wrong with a field — a closed union the UI words in the reader's language. */
export type FieldProblem =
  /** Left blank, and it may not be. */
  | 'required'
  /** Longer than `max` characters. */
  | 'too-long'
  /** Not a whole number. */
  | 'not-whole'
  /** Outside `min` … `max`. */
  | 'out-of-range'
  /** A range's maximum below its minimum. */
  | 'below-minimum'
  /** A bookmark past the book's last page (`max`). */
  | 'past-the-end'
  /** There is no book in hand to change. */
  | 'no-book';

export interface FieldError {
  readonly field: string;
  readonly problem: FieldProblem;
  readonly min?: number;
  readonly max?: number;
}

export interface ProfilePort {
  save(input: ProfileInput): Promise<Result<Profile, readonly FieldError[]>>;
}

export interface BookStart {
  readonly title: string;
  /** The page the reader has reached; 0 (the beginning) when omitted. */
  readonly bookmark?: number;
  /** How many pages the book has, if known. */
  readonly totalPages?: number;
}

export interface BookUpdate {
  /** Moves the bookmark to this page. */
  readonly bookmark?: number;
  /** Sets the book's length; null forgets it. */
  readonly totalPages?: number | null;
}

export interface BookshelfPort {
  /** Puts a book in hand (replacing any unfinished one), the bookmark where the reader is. */
  startReading(book: BookStart): Promise<Result<Bookshelf, readonly FieldError[]>>;
  /** Moves the bookmark in the book in hand, or sets its length. */
  updateBook(update: BookUpdate): Promise<Result<Bookshelf, readonly FieldError[]>>;
  /**
   * Shelves a book as finished today: the book in hand, or — with nothing in hand — a book
   * named here, or an untitled one. A given title overrides the one in hand.
   */
  finishBook(input?: { title?: string }): Promise<Result<FinishedBook, readonly FieldError[]>>;
}

export interface PageRangeUpdate {
  readonly range: PageRange;
  /** True when today's pending card fell outside the new range and was redrawn. */
  readonly todayRedrawn: boolean;
}

export interface PageRangePort {
  /** Every page count the range can produce, smallest first. */
  preview(range: PageRange): Result<readonly number[], readonly FieldError[]>;
  update(range: PageRange): Promise<Result<PageRangeUpdate, readonly FieldError[]>>;
}

export type ReminderError = 'invalid-time' | 'permission-denied' | 'unsupported' | 'delivery-failed';

export interface ReminderConfigured {
  readonly settings: ReminderSettings;
  readonly delivery: ReminderDelivery | null;
}

export interface ReminderPort {
  configure(input: { enabled: boolean; time: string }): Promise<Result<ReminderConfigured, ReminderError>>;
  /** The next instant a reminder check should run, or null when reminders are off. */
  nextCheckAt(): Promise<Date | null>;
  /** Shows a sample notification right away. */
  sendTest(): Promise<Result<void, ReminderError>>;
}

export type ReminderCheckOutcome = 'notified' | 'disabled' | 'not-yet' | 'already-read' | 'already-notified';

/**
 * The scheduled-typology driving port: whoever wakes up (the service worker on a periodic
 * sync, the page's own timer) asks the domain whether a reminder is due now.
 */
export interface ReminderCheckPort {
  run(): Promise<ReminderCheckOutcome>;
}

/** The first-visit walkthrough. */
export interface WelcomePort {
  /** True on a first visit: never welcomed, and no reader's card yet. */
  needed(): Promise<boolean>;
  installAvailability(): Promise<InstallAvailability>;
  install(): Promise<InstallOutcome>;
  /** Completed or skipped — either way, not shown again unasked. */
  finish(): Promise<void>;
  /** Asks for the walkthrough again (announced as a `welcome-requested` event). */
  replay(): Promise<void>;
}

export type LanguageError = 'unsupported-language';

/** The language the app speaks — the reader's pick, or the device's. */
export interface LanguagePort {
  choose(choice: LanguageChoice): Promise<Result<LanguageSetting, LanguageError>>;
}

/** The read model. Reactivity lives here, not in the wiring. */
export interface ReadingView {
  current(): ReadingSnapshot | null;
  /** Called immediately with the current snapshot when one exists, then on every change. */
  subscribe(listener: (snapshot: ReadingSnapshot) => void): () => void;
  onEvent(listener: (event: ReadingEvent) => void): () => void;
}
