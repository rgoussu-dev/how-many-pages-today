// The domain owns its in-memory fakes: unit tests, element previews and any future
// browser test wire the real core against these instead of IndexedDB or notifications.
import type { Clock, LanguageSource, RandomSource } from '@hmpt/kernel';
import type {
  AchievementLedger,
  AppInstaller,
  InstallAvailability,
  InstallOutcome,
  LanguageChoice,
  WelcomeState,
  Bookshelf,
  BookshelfRepository,
  ChallengeHistory,
  DailyChallenge,
  DayKey,
  NotificationPermissionState,
  Notifier,
  PageRange,
  PreferencesRepository,
  Profile,
  ProfileRepository,
  ReminderDelivery,
  ReminderNotification,
  ReminderScheduler,
  ReminderSettings,
  UnlockedAchievement,
} from '@hmpt/domain-contract';
import type { ReadingDeps } from '../reading-app';

export class InMemoryChallengeHistory implements ChallengeHistory {
  readonly byKey = new Map<DayKey, DailyChallenge>();
  async byDay(day: DayKey) {
    return this.byKey.get(day);
  }
  async createIfAbsent(challenge: DailyChallenge) {
    const existing = this.byKey.get(challenge.day);
    if (existing) return existing;
    this.byKey.set(challenge.day, challenge);
    return challenge;
  }
  async save(challenge: DailyChallenge) {
    this.byKey.set(challenge.day, challenge);
  }
  async all() {
    return [...this.byKey.values()];
  }
}

export class InMemoryProfiles implements ProfileRepository {
  profile: Profile | undefined;
  async load() {
    return this.profile;
  }
  async save(profile: Profile) {
    this.profile = profile;
  }
}

export class InMemoryShelves implements BookshelfRepository {
  shelf: Bookshelf | undefined;
  async load() {
    return this.shelf;
  }
  async save(shelf: Bookshelf) {
    this.shelf = shelf;
  }
}

export class InMemoryPreferences implements PreferencesRepository {
  range: PageRange | undefined;
  reminder: ReminderSettings | undefined;
  welcome: WelcomeState | undefined;
  language: LanguageChoice | undefined;
  async loadLanguage() {
    return this.language;
  }
  async saveLanguage(choice: LanguageChoice) {
    this.language = choice;
  }
  async loadWelcome() {
    return this.welcome;
  }
  async saveWelcome(welcome: WelcomeState) {
    this.welcome = welcome;
  }
  async loadRange() {
    return this.range;
  }
  async saveRange(range: PageRange) {
    this.range = range;
  }
  async loadReminder() {
    return this.reminder;
  }
  async saveReminder(reminder: ReminderSettings) {
    this.reminder = reminder;
  }
}

export class InMemoryAchievements implements AchievementLedger {
  readonly unlocked: UnlockedAchievement[] = [];
  async all() {
    return [...this.unlocked];
  }
  async record(unlocked: readonly UnlockedAchievement[]) {
    this.unlocked.push(...unlocked);
  }
}

/** A clock the test moves by hand. */
export class ManualClock implements Clock {
  constructor(public instant: Date) {}
  now() {
    return new Date(this.instant);
  }
  set(instant: Date) {
    this.instant = instant;
  }
}

/** Replays the given values in a loop. */
export class SequenceRandom implements RandomSource {
  #i = 0;
  constructor(private readonly values: readonly number[]) {}
  next() {
    const value = this.values[this.#i % this.values.length] ?? 0;
    this.#i += 1;
    return value;
  }
}

/** The device's languages, as the test sets them. */
export class FixedLanguages implements LanguageSource {
  constructor(public tags: readonly string[] = ['en-GB']) {}
  preferred() {
    return this.tags;
  }
}

export class RecordingNotifier implements Notifier {
  readonly sent: ReminderNotification[] = [];
  async notify(notification: ReminderNotification) {
    this.sent.push(notification);
  }
}

export class FakeScheduler implements ReminderScheduler {
  enabled = false;
  constructor(
    public permission: NotificationPermissionState = 'granted',
    public delivery: ReminderDelivery = 'background',
  ) {}
  async requestPermission() {
    return this.permission;
  }
  async enable() {
    this.enabled = true;
    return this.delivery;
  }
  async disable() {
    this.enabled = false;
  }
}

export class FakeInstaller implements AppInstaller {
  prompted = 0;
  constructor(
    public availabilityValue: InstallAvailability = 'prompt',
    public outcome: InstallOutcome = 'accepted',
  ) {}
  async availability() {
    return this.availabilityValue;
  }
  async prompt() {
    this.prompted += 1;
    return this.outcome;
  }
}

export type InMemoryDeps = ReadingDeps & {
  readonly history: InMemoryChallengeHistory;
  readonly profiles: InMemoryProfiles;
  readonly shelves: InMemoryShelves;
  readonly preferences: InMemoryPreferences;
  readonly achievements: InMemoryAchievements;
  readonly scheduler: FakeScheduler;
  readonly installer: FakeInstaller;
  readonly notifier: RecordingNotifier;
  readonly clock: ManualClock;
  readonly random: SequenceRandom;
  readonly languages: FixedLanguages;
};

export function inMemoryDeps(start: Date = new Date(2026, 10, 24, 9, 0), random: readonly number[] = [0.5]): InMemoryDeps {
  return {
    history: new InMemoryChallengeHistory(),
    profiles: new InMemoryProfiles(),
    shelves: new InMemoryShelves(),
    preferences: new InMemoryPreferences(),
    achievements: new InMemoryAchievements(),
    scheduler: new FakeScheduler(),
    installer: new FakeInstaller(),
    notifier: new RecordingNotifier(),
    clock: new ManualClock(start),
    random: new SequenceRandom(random),
    languages: new FixedLanguages(),
  };
}
