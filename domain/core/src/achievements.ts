import type {
  Achievement,
  AchievementId,
  Bookshelf,
  DailyChallenge,
  Profile,
  ReadingStats,
} from '@hmpt/domain-contract';
import { addDays, daysBetween, weekdayOf } from './days';
import { completedOnly } from './stats';

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
    title: 'First chapter',
    description: 'Complete your first daily challenge.',
    earned: ({ stats }) => stats.completedCount >= 1,
  },
  {
    id: 'streak-3',
    icon: '🔥',
    title: 'Kindling',
    description: 'Read three days in a row.',
    earned: ({ stats }) => stats.bestStreak >= 3,
  },
  {
    id: 'streak-7',
    icon: '🕯️',
    title: 'A week of words',
    description: 'Read seven days in a row.',
    earned: ({ stats }) => stats.bestStreak >= 7,
  },
  {
    id: 'streak-30',
    icon: '🏅',
    title: 'Monthly devotion',
    description: 'Read thirty days in a row.',
    earned: ({ stats }) => stats.bestStreak >= 30,
  },
  {
    id: 'streak-100',
    icon: '👑',
    title: 'Centurion',
    description: 'Read one hundred days in a row.',
    earned: ({ stats }) => stats.bestStreak >= 100,
  },
  {
    id: 'book-1',
    icon: '📕',
    title: 'The end',
    description: 'Finish your first book.',
    earned: ({ shelf }) => shelf.finished.length >= 1,
  },
  {
    id: 'books-5',
    icon: '📚',
    title: 'A shelf of your own',
    description: 'Finish five books.',
    earned: ({ shelf }) => shelf.finished.length >= 5,
  },
  {
    id: 'books-12',
    icon: '🏛️',
    title: 'A book a month',
    description: 'Finish twelve books.',
    earned: ({ shelf }) => shelf.finished.length >= 12,
  },
  {
    id: 'pages-500',
    icon: '🧭',
    title: 'Five hundred pages',
    description: 'Read 500 pages in total.',
    earned: ({ stats }) => stats.totalPages >= 500,
  },
  {
    id: 'pages-1000',
    icon: '🗺️',
    title: 'A thousand pages',
    description: 'Read 1,000 pages in total.',
    earned: ({ stats }) => stats.totalPages >= 1000,
  },
  {
    id: 'pages-5000',
    icon: '🐛',
    title: 'Bookworm',
    description: 'Read 5,000 pages in total.',
    earned: ({ stats }) => stats.totalPages >= 5000,
  },
  {
    id: 'marathon',
    icon: '🏃',
    title: 'Marathon',
    description: 'Complete a challenge of 100 pages or more.',
    earned: ({ history }) => completedOnly(history).some((c) => c.pages >= 100),
  },
  {
    id: 'early-bird',
    icon: '🌅',
    title: 'Early bird',
    description: 'Validate a challenge before 8 a.m.',
    earned: ({ history }) =>
      completedOnly(history).some((c) => {
        const hour = completedHour(c);
        return hour !== null && hour < 8;
      }),
  },
  {
    id: 'night-owl',
    icon: '🦉',
    title: 'Night owl',
    description: 'Validate a challenge after 10 p.m.',
    earned: ({ history }) =>
      completedOnly(history).some((c) => {
        const hour = completedHour(c);
        return hour !== null && hour >= 22;
      }),
  },
  {
    id: 'weekend',
    icon: '🛋️',
    title: 'Weekend warrior',
    description: 'Read on both the Saturday and the Sunday of a weekend.',
    earned: ({ history }) => {
      const days = new Set(completedOnly(history).map((c) => c.day));
      return [...days].some((day) => weekdayOf(day) === SATURDAY && days.has(addDays(day, 1)));
    },
  },
  {
    id: 'comeback',
    icon: '🌱',
    title: 'Back on the shelf',
    description: 'Return to reading after missing two days or more.',
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
    title: 'Pleased to meet you',
    description: 'Fill in your reader profile.',
    earned: ({ profile }) => profile !== null && profile.displayName.trim().length > 0,
  },
];

export const ACHIEVEMENTS: readonly Achievement[] = RULES.map(({ earned: _earned, ...achievement }) => achievement);

export const earnedAchievements = (facts: AchievementFacts): AchievementId[] =>
  RULES.filter((rule) => rule.earned(facts)).map((rule) => rule.id);
