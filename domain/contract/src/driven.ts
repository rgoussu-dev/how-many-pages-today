import type {
  Bookshelf,
  DailyChallenge,
  DayKey,
  PageRange,
  Profile,
  ReminderDelivery,
  ReminderSettings,
  UnlockedAchievement,
} from './model';

/**
 * Driven ports — what the hexagon needs from the outside world, in its own vocabulary.
 * Clock and RandomSource are ubiquitous and live in @hmpt/kernel.
 */

export interface ChallengeHistory {
  byDay(day: DayKey): Promise<DailyChallenge | undefined>;
  /**
   * Stores the challenge unless one already exists for that day, and returns whichever
   * won. The page and the service worker may both draw today's card; only one may stick.
   */
  createIfAbsent(challenge: DailyChallenge): Promise<DailyChallenge>;
  save(challenge: DailyChallenge): Promise<void>;
  all(): Promise<DailyChallenge[]>;
}

export interface ProfileRepository {
  load(): Promise<Profile | undefined>;
  save(profile: Profile): Promise<void>;
}

export interface BookshelfRepository {
  load(): Promise<Bookshelf | undefined>;
  save(shelf: Bookshelf): Promise<void>;
}

export interface PreferencesRepository {
  loadRange(): Promise<PageRange | undefined>;
  saveRange(range: PageRange): Promise<void>;
  loadReminder(): Promise<ReminderSettings | undefined>;
  saveReminder(reminder: ReminderSettings): Promise<void>;
}

export interface AchievementLedger {
  all(): Promise<UnlockedAchievement[]>;
  record(unlocked: readonly UnlockedAchievement[]): Promise<void>;
}

export type NotificationPermissionState = 'granted' | 'denied' | 'unsupported';

/** Arranges for the platform to wake the app so reminder checks can run. */
export interface ReminderScheduler {
  /** Asks for notification permission when it has not been decided yet. */
  requestPermission(): Promise<NotificationPermissionState>;
  /** Registers whatever background wake-ups this platform offers. Permission is granted. */
  enable(): Promise<ReminderDelivery>;
  disable(): Promise<void>;
}

export interface ReminderNotification {
  readonly title: string;
  readonly body: string;
  /** Notifications sharing a tag replace each other instead of piling up. */
  readonly tag: string;
}

export interface Notifier {
  notify(notification: ReminderNotification): Promise<void>;
}
