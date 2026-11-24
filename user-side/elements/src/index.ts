import { AchievementList } from './achievement-list';
import { Bookshelf } from './bookshelf';
import { Celebration } from './celebration';
import { Greeting } from './greeting';
import { HistoryCalendar } from './history-calendar';
import { ProfileForm } from './profile-form';
import { RangeForm } from './range-form';
import { ReadingOverview } from './reading-overview';
import { ReminderForm } from './reminder-form';
import { StreakSummary } from './streak-summary';
import { TodayCard } from './today-card';

export { readingContexts } from './contexts';
export { dailyReminderInvite } from './calendar-invite';

const ELEMENTS = {
  'hmpt-today-card': TodayCard,
  'hmpt-greeting': Greeting,
  'hmpt-streak-summary': StreakSummary,
  'hmpt-history-calendar': HistoryCalendar,
  'hmpt-achievement-list': AchievementList,
  'hmpt-bookshelf': Bookshelf,
  'hmpt-reading-overview': ReadingOverview,
  'hmpt-profile-form': ProfileForm,
  'hmpt-range-form': RangeForm,
  'hmpt-reminder-form': ReminderForm,
  'hmpt-celebration': Celebration,
} as const;

/**
 * Registers every port-bound element. The assembly point calls this *after* it starts
 * answering `context-request`: defining upgrades parsed markup and fires
 * connectedCallback synchronously, and each element requests its ports right there.
 */
export function defineReadingElements(registry: CustomElementRegistry = customElements): void {
  for (const [tag, element] of Object.entries(ELEMENTS)) registry.define(tag, element);
}

type Elements = typeof ELEMENTS;
declare global {
  interface HTMLElementTagNameMap extends Elements_ {}
}
type Elements_ = { [K in keyof Elements]: InstanceType<Elements[K]> };
