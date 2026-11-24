import { createContext } from '@hmpt/kernel/context';
import type {
  BookshelfPort,
  DailyChallengePort,
  LanguagePort,
  OverviewPort,
  PageRangePort,
  ProfilePort,
  ReadingView,
  ReminderPort,
  WelcomePort,
} from '@hmpt/domain-contract';

/**
 * The module's DI vocabulary: one typed key per driving port, namespaced so they cannot
 * collide with another provider's keys. The assembly point answers these.
 */
export const readingContexts = {
  challenge: createContext<DailyChallengePort>('hmpt.reading.challenge'),
  profile: createContext<ProfilePort>('hmpt.reading.profile'),
  bookshelf: createContext<BookshelfPort>('hmpt.reading.bookshelf'),
  overview: createContext<OverviewPort>('hmpt.reading.overview'),
  range: createContext<PageRangePort>('hmpt.reading.range'),
  reminder: createContext<ReminderPort>('hmpt.reading.reminder'),
  welcome: createContext<WelcomePort>('hmpt.reading.welcome'),
  language: createContext<LanguagePort>('hmpt.reading.language'),
  view: createContext<ReadingView>('hmpt.reading.view'),
} as const;
