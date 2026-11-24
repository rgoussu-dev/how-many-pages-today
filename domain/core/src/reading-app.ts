import { err, ok, type Clock, type RandomSource } from '@hmpt/kernel';
import {
  DEFAULT_PAGE_RANGE,
  DEFAULT_REMINDER,
  EMPTY_SHELF,
  type AchievementLedger,
  type Bookshelf,
  type BookshelfPort,
  type BookshelfRepository,
  type ChallengeHistory,
  type DailyChallenge,
  type DailyChallengePort,
  type Notifier,
  type PageRange,
  type PageRangePort,
  type PreferencesRepository,
  type Profile,
  type ProfilePort,
  type ProfileRepository,
  type ReadingSnapshot,
  type ReadingView,
  type ReminderCheckPort,
  type ReminderPort,
  type ReminderScheduler,
  type ReminderSettings,
} from '@hmpt/domain-contract';
import { ACHIEVEMENTS, earnedAchievements } from './achievements';
import { dayKeyOf } from './days';
import { drawArtSeed, drawPages, possiblePages, validateRange } from './pages';
import { validateProfile, validateTitle } from './profile';
import { nextReminderAt, parseTime, reminderInstantOn } from './reminders';
import { computeStats } from './stats';
import { ReadingStore } from './store';

export interface ReminderCheckDeps {
  readonly history: ChallengeHistory;
  readonly profiles: ProfileRepository;
  readonly preferences: PreferencesRepository;
  readonly notifier: Notifier;
  readonly clock: Clock;
  readonly random: RandomSource;
}

export interface ReadingDeps extends ReminderCheckDeps {
  readonly shelves: BookshelfRepository;
  readonly achievements: AchievementLedger;
  readonly scheduler: ReminderScheduler;
}

export interface ReadingApp {
  readonly challenge: DailyChallengePort;
  readonly profile: ProfilePort;
  readonly bookshelf: BookshelfPort;
  readonly range: PageRangePort;
  readonly reminder: ReminderPort;
  readonly reminderCheck: ReminderCheckPort;
  readonly view: ReadingView;
}

const REMINDER_TAG = 'daily-reading-reminder';

/** Draws today's card once; whichever process draws first (page or service worker) wins. */
async function ensureToday(deps: ReminderCheckDeps): Promise<DailyChallenge> {
  const now = deps.clock.now();
  const day = dayKeyOf(now);
  const existing = await deps.history.byDay(day);
  if (existing) return existing;
  const range = (await deps.preferences.loadRange()) ?? DEFAULT_PAGE_RANGE;
  return deps.history.createIfAbsent({
    day,
    pages: drawPages(range, deps.random),
    artSeed: drawArtSeed(deps.random),
    status: 'pending',
    drawnAt: now.toISOString(),
  });
}

const loadReminder = async (deps: ReminderCheckDeps): Promise<ReminderSettings> =>
  (await deps.preferences.loadReminder()) ?? DEFAULT_REMINDER;

/**
 * The scheduled driving port, assembled on its own so the service worker can run it
 * without the read model or the achievement machinery.
 */
export function createReminderCheck(deps: ReminderCheckDeps): ReminderCheckPort {
  return {
    async run() {
      const settings = await loadReminder(deps);
      if (!settings.enabled) return 'disabled';
      const now = deps.clock.now();
      const today = dayKeyOf(now);
      const due = reminderInstantOn(today, settings.time);
      if (!due || now < due) return 'not-yet';
      if (settings.lastNotifiedOn === today) return 'already-notified';

      const challenge = await ensureToday(deps);
      if (challenge.status === 'completed') return 'already-read';

      const [profile, history] = await Promise.all([deps.profiles.load(), deps.history.all()]);
      const streak = computeStats(history, today).currentStreak;
      const who = profile?.displayName ? `${profile.displayName}, today` : 'Today';
      const nudge =
        streak > 0 ? `Keep your ${streak}-day streak alive 🔥` : 'A fresh card is waiting for you 📖';
      await deps.notifier.notify({
        title: 'How many pages today?',
        body: `${who}'s card: ${challenge.pages} pages. ${nudge}`,
        tag: REMINDER_TAG,
      });
      await deps.preferences.saveReminder({ ...settings, lastNotifiedOn: today });
      return 'notified';
    },
  };
}

export function createReadingApp(deps: ReadingDeps): ReadingApp {
  const store = new ReadingStore();
  const today = () => dayKeyOf(deps.clock.now());
  const loadShelf = async (): Promise<Bookshelf> => (await deps.shelves.load()) ?? EMPTY_SHELF;

  async function snapshotFor(todayChallenge: DailyChallenge): Promise<ReadingSnapshot> {
    const [history, profile, shelf, range, reminder, unlocked] = await Promise.all([
      deps.history.all(),
      deps.profiles.load(),
      loadShelf(),
      deps.preferences.loadRange(),
      loadReminder(deps),
      deps.achievements.all(),
    ]);
    const unlockedOn = new Map(unlocked.map((u) => [u.id, u.unlockedOn]));
    return {
      today: todayChallenge,
      history: [...history].sort((a, b) => b.day.localeCompare(a.day)),
      profile: profile ?? null,
      shelf,
      range: range ?? DEFAULT_PAGE_RANGE,
      reminder,
      stats: computeStats(history, today(), shelf.finished.length),
      achievements: ACHIEVEMENTS.map((a) => {
        const on = unlockedOn.get(a.id);
        return on === undefined ? { ...a } : { ...a, unlockedOn: on };
      }),
    };
  }

  async function refresh(): Promise<DailyChallenge> {
    const challenge = await ensureToday(deps);
    store.publish(await snapshotFor(challenge));
    return challenge;
  }

  /** Records newly earned achievements (they are never taken back) and announces them. */
  async function awardAchievements(): Promise<void> {
    const [history, profile, shelf, unlocked] = await Promise.all([
      deps.history.all(),
      deps.profiles.load(),
      loadShelf(),
      deps.achievements.all(),
    ]);
    const known = new Set(unlocked.map((u) => u.id));
    const stats = computeStats(history, today(), shelf.finished.length);
    const fresh = earnedAchievements({ history, profile: profile ?? null, shelf, stats }).filter(
      (id) => !known.has(id),
    );
    if (fresh.length === 0) return;
    await deps.achievements.record(fresh.map((id) => ({ id, unlockedOn: today() })));
    for (const id of fresh) {
      const achievement = ACHIEVEMENTS.find((a) => a.id === id);
      if (achievement) store.emit({ type: 'achievement-unlocked', achievement });
    }
  }

  const challenge: DailyChallengePort = {
    open: refresh,

    async complete() {
      const current = await ensureToday(deps);
      if (current.status === 'completed') return err('already-completed');
      const done: DailyChallenge = { ...current, status: 'completed', completedAt: deps.clock.now().toISOString() };
      await deps.history.save(done);
      const streak = computeStats(await deps.history.all(), today()).currentStreak;
      store.emit({ type: 'challenge-completed', challenge: done, streak });
      await awardAchievements();
      await refresh();
      return ok(done);
    },
  };

  const profile: ProfilePort = {
    async save(input) {
      const valid = validateProfile(input);
      if (!valid.ok) return valid;
      const existing = await deps.profiles.load();
      const firstDay = (await deps.history.all()).map((c) => c.day).sort()[0];
      const saved: Profile = { ...valid.value, readerSince: existing?.readerSince ?? firstDay ?? today() };
      await deps.profiles.save(saved);
      await awardAchievements();
      await refresh();
      return ok(saved);
    },
  };

  const bookshelf: BookshelfPort = {
    async startReading(title) {
      const valid = validateTitle(title);
      if (!valid.ok) return valid;
      const shelf: Bookshelf = { ...(await loadShelf()), current: valid.value };
      await deps.shelves.save(shelf);
      await refresh();
      return ok(shelf);
    },

    async finishCurrent() {
      const shelf = await loadShelf();
      if (shelf.current === null) return err('nothing-in-progress');
      const book = { title: shelf.current, finishedOn: today() };
      const finished = [...shelf.finished, book];
      await deps.shelves.save({ current: null, finished });
      store.emit({ type: 'book-finished', book, booksRead: finished.length });
      await awardAchievements();
      await refresh();
      return ok(book);
    },
  };

  const range: PageRangePort = {
    preview(candidate) {
      const valid = validateRange(candidate);
      return valid.ok ? ok(possiblePages(valid.value)) : valid;
    },

    async update(candidate) {
      const valid = validateRange(candidate);
      if (!valid.ok) return valid;
      const next: PageRange = valid.value;
      await deps.preferences.saveRange(next);
      // Today's card stands — unless it is still unread and the new range excludes it.
      const current = await ensureToday(deps);
      const todayRedrawn = current.status === 'pending' && !possiblePages(next).includes(current.pages);
      if (todayRedrawn) await deps.history.save({ ...current, pages: drawPages(next, deps.random) });
      await refresh();
      return ok({ range: next, todayRedrawn });
    },
  };

  const reminder: ReminderPort = {
    async configure(input) {
      if (!parseTime(input.time)) return err('invalid-time');
      let delivery = null;
      if (input.enabled) {
        const permission = await deps.scheduler.requestPermission();
        if (permission === 'denied') return err('permission-denied');
        if (permission === 'unsupported') return err('unsupported');
        delivery = await deps.scheduler.enable();
      } else {
        await deps.scheduler.disable();
      }
      const previous = await loadReminder(deps);
      // Moving the time re-arms today's reminder; keeping it never nags twice.
      const settings: ReminderSettings =
        previous.time === input.time && previous.lastNotifiedOn !== undefined
          ? { enabled: input.enabled, time: input.time, lastNotifiedOn: previous.lastNotifiedOn }
          : { enabled: input.enabled, time: input.time };
      await deps.preferences.saveReminder(settings);
      await refresh();
      return ok({ settings, delivery });
    },

    async nextCheckAt() {
      return nextReminderAt(deps.clock.now(), await loadReminder(deps));
    },

    async sendTest() {
      const permission = await deps.scheduler.requestPermission();
      if (permission === 'denied') return err('permission-denied');
      if (permission === 'unsupported') return err('unsupported');
      const current = await ensureToday(deps);
      try {
        await deps.notifier.notify({
          title: 'How many pages today?',
          body: `This is what your reminder will look like. Today's card: ${current.pages} pages.`,
          tag: `${REMINDER_TAG}-test`,
        });
      } catch {
        return err('delivery-failed');
      }
      return ok(undefined);
    },
  };

  return {
    challenge,
    profile,
    bookshelf,
    range,
    reminder,
    reminderCheck: createReminderCheck(deps),
    view: store,
  };
}
