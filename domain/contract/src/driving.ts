import type { Result } from '@hmpt/kernel';
import type {
  Bookshelf,
  DailyChallenge,
  FinishedBook,
  InstallAvailability,
  InstallOutcome,
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

export type ChallengeError = 'already-completed' | 'not-completed' | 'invalid-pages' | 'invalid-title';

export interface ReadingLog {
  /** Pages actually read; the day's goal when omitted. */
  readonly pagesRead?: number;
  /** Finish a book along with the day's reading (the one in hand, or `bookTitle`). */
  readonly finishedBook?: boolean;
  /** Optional title for the finished book; defaults to the book in hand. */
  readonly bookTitle?: string;
}

export interface DailyChallengePort {
  /** Draws today's card if it does not exist yet, then refreshes the read model. Idempotent. */
  open(): Promise<DailyChallenge>;
  /** The reader has opened today's card. Idempotent; the first opening is kept. */
  unveil(): Promise<DailyChallenge>;
  /** Logs today's reading. Final — a day read stays read. */
  complete(log?: ReadingLog): Promise<Result<DailyChallenge, ChallengeError>>;
  /** Adds pages read later the same day. Only ever upward. */
  addPages(pages: number): Promise<Result<DailyChallenge, ChallengeError>>;
}

export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export interface ProfilePort {
  save(input: ProfileInput): Promise<Result<Profile, readonly FieldError[]>>;
}

export interface BookshelfPort {
  /** Puts a book in hand (replacing any unfinished one). */
  startReading(title: string): Promise<Result<Bookshelf, readonly FieldError[]>>;
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

/** The read model. Reactivity lives here, not in the wiring. */
export interface ReadingView {
  current(): ReadingSnapshot | null;
  /** Called immediately with the current snapshot when one exists, then on every change. */
  subscribe(listener: (snapshot: ReadingSnapshot) => void): () => void;
  onEvent(listener: (event: ReadingEvent) => void): () => void;
}
