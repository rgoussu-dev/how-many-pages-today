import { createContext } from '@hmpt/kernel/context';
import type {
  BookshelfPort,
  DailyChallengePort,
  PageRangePort,
  ProfilePort,
  ReadingView,
  ReminderPort,
} from '@hmpt/domain-contract';

/**
 * The module's DI vocabulary: one typed key per driving port, namespaced so they cannot
 * collide with another provider's keys. The assembly point answers these.
 */
export const readingContexts = {
  challenge: createContext<DailyChallengePort>('hmpt.reading.challenge'),
  profile: createContext<ProfilePort>('hmpt.reading.profile'),
  bookshelf: createContext<BookshelfPort>('hmpt.reading.bookshelf'),
  range: createContext<PageRangePort>('hmpt.reading.range'),
  reminder: createContext<ReminderPort>('hmpt.reading.reminder'),
  view: createContext<ReadingView>('hmpt.reading.view'),
} as const;
