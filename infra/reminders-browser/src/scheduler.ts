import type { NotificationPermissionState, ReminderDelivery, ReminderScheduler } from '@hmpt/domain-contract';
import { REMINDER_SYNC_TAG } from './sync-tag';

export { REMINDER_SYNC_TAG };

/*
 * Periodic Background Sync is Chromium-only and absent from TypeScript's DOM lib.
 * https://wicg.github.io/periodic-background-sync/
 */
interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
}
type WithPeriodicSync = ServiceWorkerRegistration & { periodicSync?: PeriodicSyncManager };

/** Ask to be woken roughly hourly; the browser decides the real cadence (often ~12h). */
const MIN_INTERVAL_MS = 60 * 60 * 1000;

/**
 * The page-side scheduler. A static site has no push server, so the only background
 * wake-up the web offers is Periodic Background Sync — installed PWAs on Chromium
 * (Android, desktop Chrome/Edge). Everywhere else reminders fire while the app is open.
 */
export class BrowserReminderScheduler implements ReminderScheduler {
  constructor(private readonly registration: () => Promise<ServiceWorkerRegistration | undefined>) {}

  async requestPermission(): Promise<NotificationPermissionState> {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return (await Notification.requestPermission()) === 'granted' ? 'granted' : 'denied';
  }

  async enable(): Promise<ReminderDelivery> {
    const registration = (await this.registration()) as WithPeriodicSync | undefined;
    if (!registration?.periodicSync) return 'while-open';
    try {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName });
      if (status.state !== 'granted') return 'while-open';
      await registration.periodicSync.register(REMINDER_SYNC_TAG, { minInterval: MIN_INTERVAL_MS });
      return 'background';
    } catch {
      return 'while-open';
    }
  }

  async disable(): Promise<void> {
    const registration = (await this.registration()) as WithPeriodicSync | undefined;
    await registration?.periodicSync?.unregister(REMINDER_SYNC_TAG).catch(() => undefined);
  }
}
