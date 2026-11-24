import type {
  Achievement,
  AchievementId,
  Bookshelf,
  DailyChallenge,
  Profile,
  ReadingStats,
} from '@hmpt/domain-contract';
import { addDays, daysBetween, weekdayOf } from './days';
import { completedOnly, goalMetOf, pagesReadOf } from './stats';

interface AchievementRule extends Achievement {
  readonly earned: (facts: AchievementFacts) => boolean;
}

export interface AchievementFacts {
  readonly history: readonly DailyChallenge[];
  readonly profile: Profile | null;
  readonly shelf: Bookshelf;
  readonly stats: ReadingStats;
}

const completedHour = (c: DailyChallenge): number | null =>
  c.completedAt === undefined ? null : new Date(c.completedAt).getHours();

const SATURDAY = 6;

const RULES: readonly AchievementRule[] = [
  {
    id: 'first-challenge',
    icon: '📖',
    earned: ({ stats }) => stats.completedCount >= 1,
  },
  {
    id: 'streak-3',
    icon: '🔥',
    earned: ({ stats }) => stats.bestStreak >= 3,
  },
  {
    id: 'streak-7',
    icon: '🕯️',
    earned: ({ stats }) => stats.bestStreak >= 7,
  },
  {
    id: 'streak-30',
    icon: '🏅',
    earned: ({ stats }) => stats.bestStreak >= 30,
  },
  {
    id: 'streak-100',
    icon: '👑',
    earned: ({ stats }) => stats.bestStreak >= 100,
  },
  {
    id: 'book-1',
    icon: '📕',
    earned: ({ shelf }) => shelf.finished.length >= 1,
  },
  {
    id: 'books-5',
    icon: '📚',
    earned: ({ shelf }) => shelf.finished.length >= 5,
  },
  {
    id: 'books-12',
    icon: '🏛️',
    earned: ({ shelf }) => shelf.finished.length >= 12,
  },
  {
    id: 'pages-500',
    icon: '🧭',
    earned: ({ stats }) => stats.totalPages >= 500,
  },
  {
    id: 'pages-1000',
    icon: '🗺️',
    earned: ({ stats }) => stats.totalPages >= 1000,
  },
  {
    id: 'pages-5000',
    icon: '🐛',
    earned: ({ stats }) => stats.totalPages >= 5000,
  },
  {
    id: 'marathon',
    icon: '🏃',
    earned: ({ history }) => completedOnly(history).some((c) => pagesReadOf(c) >= 100),
  },
  {
    id: 'beyond-goal',
    icon: '✨',
    earned: ({ history }) => completedOnly(history).some((c) => pagesReadOf(c) > c.pages),
  },
  {
    id: 'double-goal',
    icon: '🌙',
    earned: ({ history }) => completedOnly(history).some((c) => pagesReadOf(c) >= 2 * c.pages),
  },
  {
    id: 'extra-100',
    icon: '🎁',
    earned: ({ stats }) => stats.extraPages >= 100,
  },
  {
    id: 'page-binge',
    icon: '🌀',
    earned: ({ history }) => completedOnly(history).some((c) => pagesReadOf(c) >= 200),
  },
  {
    id: 'little-by-little',
    icon: '🐢',
    earned: ({ history }) => completedOnly(history).some((c) => !goalMetOf(c) && pagesReadOf(c) > 0),
  },
  {
    id: 'final-chapter',
    icon: '🔖',
    earned: ({ history }) => completedOnly(history).some((c) => c.finishedBook === true),
  },
  {
    id: 'early-bird',
    icon: '🌅',
    earned: ({ history }) =>
      completedOnly(history).some((c) => {
        const hour = completedHour(c);
        return hour !== null && hour < 8;
      }),
  },
  {
    id: 'night-owl',
    icon: '🦉',
    earned: ({ history }) =>
      completedOnly(history).some((c) => {
        const hour = completedHour(c);
        return hour !== null && hour >= 22;
      }),
  },
  {
    id: 'weekend',
    icon: '🛋️',
    earned: ({ history }) => {
      const days = new Set(completedOnly(history).map((c) => c.day));
      return [...days].some((day) => weekdayOf(day) === SATURDAY && days.has(addDays(day, 1)));
    },
  },
  {
    id: 'comeback',
    icon: '🌱',
    earned: ({ history }) => {
      const days = completedOnly(history)
        .map((c) => c.day)
        .sort();
      return days.some((day, i) => i > 0 && daysBetween(days[i - 1]!, day) >= 3);
    },
  },
  {
    id: 'introductions',
    icon: '🪪',
    earned: ({ profile }) => profile !== null && profile.displayName.trim().length > 0,
  },
];

export const ACHIEVEMENTS: readonly Achievement[] = RULES.map(({ earned: _earned, ...achievement }) => achievement);

export const earnedAchievements = (facts: AchievementFacts): AchievementId[] =>
  RULES.filter((rule) => rule.earned(facts)).map((rule) => rule.id);
