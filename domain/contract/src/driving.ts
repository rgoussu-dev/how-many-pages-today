import type { Result } from '@hmpt/kernel';
import type {
  DailyChallenge,
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

export type ChallengeError = 'already-completed' | 'not-completed';

export interface DailyChallengePort {
  /** Draws today's card if it does not exist yet, then refreshes the read model. Idempotent. */
  open(): Promise<DailyChallenge>;
  /** "I read them": validates today's challenge. */
  complete(): Promise<Result<DailyChallenge, ChallengeError>>;
  /** Takes back today's validation (achievements already earned are kept). */
  undo(): Promise<Result<DailyChallenge, ChallengeError>>;
}

export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export interface ProfilePort {
  save(input: ProfileInput): Promise<Result<Profile, readonly FieldError[]>>;
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

/** The read model. Reactivity lives here, not in the wiring. */
export interface ReadingView {
  current(): ReadingSnapshot | null;
  /** Called immediately with the current snapshot when one exists, then on every change. */
  subscribe(listener: (snapshot: ReadingSnapshot) => void): () => void;
  onEvent(listener: (event: ReadingEvent) => void): () => void;
}
