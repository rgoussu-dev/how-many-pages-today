import { err, ok, type Clock, type LanguageSource, type RandomSource } from '@hmpt/kernel';
import {
  DEFAULT_PAGE_RANGE,
  DEFAULT_REMINDER,
  EMPTY_SHELF,
  type AchievementLedger,
  type AppInstaller,
  type BookInHand,
  type Bookshelf,
  type BookshelfPort,
  type BookshelfRepository,
  type ChallengeHistory,
  type DailyChallenge,
  type DailyChallengePort,
  type FieldError,
  type FinishedBook,
  type LanguagePort,
  type LanguageSetting,
  type OverviewPort,
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
  type WelcomePort,
} from '@hmpt/domain-contract';
import { ACHIEVEMENTS, earnedAchievements } from './achievements';
import { advance, readTo } from './bookmark';
import { dayKeyOf } from './days';
import { isLanguageChoice, resolveLanguage } from './language';
import { drawArtSeed, drawPages, possiblePages, validateRange } from './pages';
import { validateBookPage, validateOptionalTitle, validatePagesRead, validateProfile, validateTitle } from './profile';
import { monthOverview, yearOverview } from './overview';
import { nextReminderAt, parseTime, reminderInstantOn } from './reminders';
import { computeStats, goalMetOf, pagesReadOf } from './stats';
import { ReadingStore } from './store';
import { reminderNotification, testNotification } from './wording';

export interface ReminderCheckDeps {
  readonly history: ChallengeHistory;
  readonly profiles: ProfileRepository;
  readonly shelves: BookshelfRepository;
  readonly preferences: PreferencesRepository;
  readonly notifier: Notifier;
  readonly clock: Clock;
  readonly random: RandomSource;
  readonly languages: LanguageSource;
}

export interface ReadingDeps extends ReminderCheckDeps {
  readonly installer: AppInstaller;
  readonly achievements: AchievementLedger;
  readonly scheduler: ReminderScheduler;
}

export interface ReadingApp {
  readonly challenge: DailyChallengePort;
  readonly profile: ProfilePort;
  readonly bookshelf: BookshelfPort;
  readonly overview: OverviewPort;
  readonly range: PageRangePort;
  readonly reminder: ReminderPort;
  readonly reminderCheck: ReminderCheckPort;
  readonly welcome: WelcomePort;
  readonly language: LanguagePort;
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

const loadLanguage = async (deps: ReminderCheckDeps): Promise<LanguageSetting> =>
  resolveLanguage((await deps.preferences.loadLanguage()) ?? 'auto', deps.languages.preferred());

/** Shelves saved before books carried a start date held the book in hand as a bare title. */
const upgradeShelf = (stored: Bookshelf | undefined, today: string): Bookshelf => {
  if (!stored) return EMPTY_SHELF;
  const current = stored.current as unknown;
  return typeof current === 'string' ? { ...stored, current: { title: current, startedOn: today } } : stored;
};

/** A bookmark and a length that fit together: the bookmark within the book. */
function validateBook(bookmark: number | undefined, totalPages: number | undefined): FieldError[] {
  const errors: FieldError[] = [];
  if (bookmark !== undefined) {
    const valid = validateBookPage(bookmark, 'bookmark');
    if (!valid.ok) errors.push(...valid.error);
  }
  if (totalPages !== undefined) {
    const valid = validateBookPage(totalPages, 'totalPages');
    if (!valid.ok) errors.push(...valid.error);
  }
  if (errors.length === 0 && bookmark !== undefined && totalPages !== undefined && bookmark > totalPages)
    errors.push({ field: 'bookmark', problem: 'past-the-end', max: totalPages });
  return errors;
}

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

      const [profile, history, shelf, language] = await Promise.all([
        deps.profiles.load(),
        deps.history.all(),
        deps.shelves.load(),
        loadLanguage(deps),
      ]);
      const facts = {
        pages: challenge.pages,
        streak: computeStats(history, today).currentStreak,
        readerName: profile?.displayName || null,
        untilPage: readTo(upgradeShelf(shelf, today).current, challenge.pages),
      };
      await deps.notifier.notify(reminderNotification(language.language, facts, REMINDER_TAG));
      await deps.preferences.saveReminder({ ...settings, lastNotifiedOn: today });
      return 'notified';
    },
  };
}

export function createReadingApp(deps: ReadingDeps): ReadingApp {
  const store = new ReadingStore();
  const today = () => dayKeyOf(deps.clock.now());
  const loadShelf = async (): Promise<Bookshelf> => upgradeShelf(await deps.shelves.load(), today());

  /** Moves the bookmark in the book in hand on by pages just read. */
  async function turnPages(pages: number): Promise<void> {
    const shelf = await loadShelf();
    if (!shelf.current) return;
    const moved = advance(shelf.current, pages);
    if (moved !== shelf.current) await deps.shelves.save({ ...shelf, current: moved });
  }

  /** Puts a finished book on the shelf and announces it. The caller refreshes. */
  async function shelve(title: string | null): Promise<FinishedBook> {
    const shelf = await loadShelf();
    const inHand = shelf.current;
    const book: FinishedBook = {
      title: title ?? inHand?.title ?? null,
      ...(inHand && (title === null || title === inHand.title) ? { startedOn: inHand.startedOn } : {}),
      finishedOn: today(),
    };
    const finished = [...shelf.finished, book];
    await deps.shelves.save({ current: null, finished });
    store.emit({ type: 'book-finished', book, booksRead: finished.length });
    return book;
  }

  async function snapshotFor(todayChallenge: DailyChallenge): Promise<ReadingSnapshot> {
    const [history, profile, shelf, range, reminder, language, unlocked] = await Promise.all([
      deps.history.all(),
      deps.profiles.load(),
      loadShelf(),
      deps.preferences.loadRange(),
      loadReminder(deps),
      loadLanguage(deps),
      deps.achievements.all(),
    ]);
    const unlockedOn = new Map(unlocked.map((u) => [u.id, u.unlockedOn]));
    return {
      today: todayChallenge,
      history: [...history].sort((a, b) => b.day.localeCompare(a.day)),
      profile: profile ?? null,
      shelf,
      readTo: todayChallenge.status === 'pending' ? readTo(shelf.current, todayChallenge.pages) : null,
      range: range ?? DEFAULT_PAGE_RANGE,
      reminder,
      language,
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

    async unveil() {
      const current = await ensureToday(deps);
      if (current.unveiledAt !== undefined) return current;
      const unveiled: DailyChallenge = { ...current, unveiledAt: deps.clock.now().toISOString() };
      await deps.history.save(unveiled);
      await refresh();
      return unveiled;
    },

    async complete(log = {}) {
      const current = await ensureToday(deps);
      if (current.status === 'completed') return err('already-completed');
      const pagesRead = log.pagesRead ?? current.pages;
      if (!validatePagesRead(pagesRead).ok) return err('invalid-pages');
      const title = validateOptionalTitle(log.bookTitle);
      if (!title.ok) return err('invalid-title');

      const finishedBook = log.finishedBook === true;
      const done: DailyChallenge = {
        ...current,
        status: 'completed',
        completedAt: deps.clock.now().toISOString(),
        pagesRead,
        finishedBook,
        goalMet: pagesRead >= current.pages || finishedBook,
      };
      await deps.history.save(done);
      await turnPages(pagesRead);
      const streak = computeStats(await deps.history.all(), today()).currentStreak;
      store.emit({ type: 'challenge-completed', challenge: done, streak });
      if (finishedBook) await shelve(title.value);
      await awardAchievements();
      await refresh();
      return ok(done);
    },

    async addPages(pages) {
      const current = await ensureToday(deps);
      if (current.status !== 'completed') return err('not-completed');
      if (!validatePagesRead(pages).ok) return err('invalid-pages');
      const pagesRead = pagesReadOf(current) + pages;
      const updated: DailyChallenge = {
        ...current,
        pagesRead,
        goalMet: goalMetOf(current) || pagesRead >= current.pages,
      };
      await deps.history.save(updated);
      await turnPages(pages);
      store.emit({ type: 'pages-added', challenge: updated, added: pages });
      await awardAchievements();
      await refresh();
      return ok(updated);
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
    async startReading({ title, bookmark = 0, totalPages }) {
      const valid = validateTitle(title);
      const errors = [...(valid.ok ? [] : valid.error), ...validateBook(bookmark, totalPages)];
      if (!valid.ok || errors.length > 0) return err(errors);
      const book: BookInHand = {
        title: valid.value,
        startedOn: today(),
        bookmark,
        ...(totalPages === undefined ? {} : { totalPages }),
      };
      const shelf: Bookshelf = { ...(await loadShelf()), current: book };
      await deps.shelves.save(shelf);
      await refresh();
      return ok(shelf);
    },

    async updateBook(update) {
      const stored = await loadShelf();
      const book = stored.current;
      if (!book) return err([{ field: 'bookmark', problem: 'no-book' }]);
      const bookmark = update.bookmark ?? book.bookmark;
      const totalPages = update.totalPages === null ? undefined : (update.totalPages ?? book.totalPages);
      const errors = validateBook(bookmark, totalPages);
      if (errors.length > 0) return err(errors);
      const { bookmark: _b, totalPages: _t, ...rest } = book;
      const current: BookInHand = {
        ...rest,
        ...(bookmark === undefined ? {} : { bookmark }),
        ...(totalPages === undefined ? {} : { totalPages }),
      };
      const shelf: Bookshelf = { ...stored, current };
      await deps.shelves.save(shelf);
      await refresh();
      return ok(shelf);
    },

    async finishBook(input = {}) {
      const title = validateOptionalTitle(input.title);
      if (!title.ok) return title;
      const book = await shelve(title.value);
      await awardAchievements();
      await refresh();
      return ok(book);
    },
  };

  const overview: OverviewPort = {
    async month(year, month) {
      const [history, shelf] = await Promise.all([deps.history.all(), loadShelf()]);
      return monthOverview(history, shelf, year, month, today());
    },
    async year(year) {
      const [history, shelf] = await Promise.all([deps.history.all(), loadShelf()]);
      return yearOverview(history, shelf, year, today());
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
      const [current, language] = await Promise.all([ensureToday(deps), loadLanguage(deps)]);
      try {
        await deps.notifier.notify(testNotification(language.language, current.pages, `${REMINDER_TAG}-test`));
      } catch {
        return err('delivery-failed');
      }
      return ok(undefined);
    },
  };

  const welcome: WelcomePort = {
    async needed() {
      const [state, profile] = await Promise.all([deps.preferences.loadWelcome(), deps.profiles.load()]);
      return state?.completedOn === undefined && profile === undefined;
    },
    installAvailability: () => deps.installer.availability(),
    install: () => deps.installer.prompt(),
    async finish() {
      const state = (await deps.preferences.loadWelcome()) ?? {};
      await deps.preferences.saveWelcome({ ...state, completedOn: today() });
    },
    async replay() {
      store.emit({ type: 'welcome-requested' });
    },
  };

  const language: LanguagePort = {
    async choose(choice) {
      if (!isLanguageChoice(choice)) return err('unsupported-language');
      await deps.preferences.saveLanguage(choice);
      await refresh();
      return ok(resolveLanguage(choice, deps.languages.preferred()));
    },
  };

  return {
    challenge,
    profile,
    bookshelf,
    overview,
    range,
    reminder,
    reminderCheck: createReminderCheck(deps),
    welcome,
    language,
    view: store,
  };
}
