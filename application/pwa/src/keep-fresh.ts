import type { ReadingApp } from '@hmpt/domain-core';

const MAX_TIMEOUT = 2 ** 31 - 1;

/**
 * Time-driven upkeep while the page is alive — a driving adapter of the scheduled kind:
 * - a new day deals a new card (at midnight, and whenever the app comes back to the foreground);
 * - the reminder check runs at the reminder time while the app is open. (When it is
 *   closed, the service worker's periodic sync runs the very same check.)
 */
export function keepFresh(app: ReadingApp): void {
  let midnight: ReturnType<typeof setTimeout> | undefined;
  let reminder: ReturnType<typeof setTimeout> | undefined;

  const armMidnight = () => {
    clearTimeout(midnight);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    midnight = setTimeout(() => void refresh(), next.getTime() - now.getTime());
  };

  const armReminder = async () => {
    clearTimeout(reminder);
    const at = await app.reminder.nextCheckAt();
    if (!at) return;
    const delay = Math.min(MAX_TIMEOUT, Math.max(0, at.getTime() - Date.now()));
    reminder = setTimeout(async () => {
      await app.reminderCheck.run().catch((error: unknown) => console.warn('Reminder check failed', error));
      void armReminder();
    }, delay);
  };

  const refresh = async () => {
    await app.challenge.open();
    armMidnight();
    void armReminder();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh();
  });

  // Re-arm whenever the reminder settings change.
  let lastReminder = '';
  app.view.subscribe(({ reminder: settings }) => {
    const key = `${settings.enabled}|${settings.time}`;
    if (key === lastReminder) return;
    lastReminder = key;
    void armReminder();
  });

  armMidnight();
}
