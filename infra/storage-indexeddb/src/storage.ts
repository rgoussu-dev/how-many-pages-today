import type {
  AchievementLedger,
  ChallengeHistory,
  DailyChallenge,
  DayKey,
  PageRange,
  PreferencesRepository,
  Profile,
  ProfileRepository,
  ReminderSettings,
  UnlockedAchievement,
} from '@hmpt/domain-contract';

/*
 * One IndexedDB database backs every repository port. IndexedDB rather than localStorage
 * because the service worker must read the same state to decide whether a reminder is
 * due — and service workers have no localStorage.
 *
 * Compiled against the WebWorker lib: everything here must work in both contexts.
 */

export const DATABASE_NAME = 'how-many-pages-today';
const VERSION = 1;
const CHALLENGES = 'challenges';
const SETTINGS = 'settings';
const ACHIEVEMENTS = 'achievements';

type SettingKey = 'profile' | 'range' | 'reminder';

const promised = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const completed = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });

class Settings {
  constructor(private readonly db: IDBDatabase) {}

  get<T>(key: SettingKey): Promise<T | undefined> {
    return promised(this.db.transaction(SETTINGS).objectStore(SETTINGS).get(key)) as Promise<T | undefined>;
  }

  async put(key: SettingKey, value: unknown): Promise<void> {
    const tx = this.db.transaction(SETTINGS, 'readwrite');
    tx.objectStore(SETTINGS).put(value, key);
    await completed(tx);
  }
}

class IndexedDbChallengeHistory implements ChallengeHistory {
  constructor(private readonly db: IDBDatabase) {}

  byDay(day: DayKey): Promise<DailyChallenge | undefined> {
    return promised(this.db.transaction(CHALLENGES).objectStore(CHALLENGES).get(day));
  }

  async createIfAbsent(challenge: DailyChallenge): Promise<DailyChallenge> {
    // A single readwrite transaction: the read and the conditional write cannot
    // interleave with another context (page or service worker) drawing the same day.
    const tx = this.db.transaction(CHALLENGES, 'readwrite');
    const store = tx.objectStore(CHALLENGES);
    const existing = (await promised(store.get(challenge.day))) as DailyChallenge | undefined;
    if (!existing) store.add(challenge);
    await completed(tx);
    return existing ?? challenge;
  }

  async save(challenge: DailyChallenge): Promise<void> {
    const tx = this.db.transaction(CHALLENGES, 'readwrite');
    tx.objectStore(CHALLENGES).put(challenge);
    await completed(tx);
  }

  all(): Promise<DailyChallenge[]> {
    return promised(this.db.transaction(CHALLENGES).objectStore(CHALLENGES).getAll());
  }
}

class IndexedDbProfiles implements ProfileRepository {
  constructor(private readonly settings: Settings) {}
  load = () => this.settings.get<Profile>('profile');
  save = (profile: Profile) => this.settings.put('profile', profile);
}

class IndexedDbPreferences implements PreferencesRepository {
  constructor(private readonly settings: Settings) {}
  loadRange = () => this.settings.get<PageRange>('range');
  saveRange = (range: PageRange) => this.settings.put('range', range);
  loadReminder = () => this.settings.get<ReminderSettings>('reminder');
  saveReminder = (reminder: ReminderSettings) => this.settings.put('reminder', reminder);
}

class IndexedDbAchievements implements AchievementLedger {
  constructor(private readonly db: IDBDatabase) {}

  all(): Promise<UnlockedAchievement[]> {
    return promised(this.db.transaction(ACHIEVEMENTS).objectStore(ACHIEVEMENTS).getAll());
  }

  async record(unlocked: readonly UnlockedAchievement[]): Promise<void> {
    const tx = this.db.transaction(ACHIEVEMENTS, 'readwrite');
    const store = tx.objectStore(ACHIEVEMENTS);
    // `add`, not `put`: a first unlock date is never overwritten.
    for (const achievement of unlocked) {
      const request = store.add(achievement);
      request.onerror = (event) => {
        event.preventDefault(); // already recorded by another context — keep the original
        event.stopPropagation();
      };
    }
    await completed(tx);
  }
}

export interface ReadingStorage {
  readonly history: ChallengeHistory;
  readonly profiles: ProfileRepository;
  readonly preferences: PreferencesRepository;
  readonly achievements: AchievementLedger;
  close(): void;
}

export async function openReadingDatabase(name: string = DATABASE_NAME): Promise<ReadingStorage> {
  const request = indexedDB.open(name, VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(CHALLENGES)) db.createObjectStore(CHALLENGES, { keyPath: 'day' });
    if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS);
    if (!db.objectStoreNames.contains(ACHIEVEMENTS)) db.createObjectStore(ACHIEVEMENTS, { keyPath: 'id' });
  };
  const db = await promised(request);
  // A newer schema opened elsewhere (fresh service worker): step aside instead of blocking it.
  db.onversionchange = () => db.close();
  const settings = new Settings(db);
  return {
    history: new IndexedDbChallengeHistory(db),
    profiles: new IndexedDbProfiles(settings),
    preferences: new IndexedDbPreferences(settings),
    achievements: new IndexedDbAchievements(db),
    close: () => db.close(),
  };
}
