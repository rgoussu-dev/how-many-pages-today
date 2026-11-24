import type { Notifier, ReminderNotification } from '@hmpt/domain-contract';

export { REMINDER_SYNC_TAG } from './sync-tag';

export interface NotificationAssets {
  /** Absolute or scope-relative URLs. */
  readonly icon: string;
  readonly badge: string;
  /** Where a click on the notification takes the reader. */
  readonly openUrl: string;
}

/**
 * Shows notifications through the service worker registration — the only way that works
 * on Android, and the same call from the page and from the worker itself.
 * Typed against ServiceWorkerRegistration only, so it compiles under DOM and WebWorker libs.
 */
export class RegistrationNotifier implements Notifier {
  constructor(
    private readonly registration: () => Promise<ServiceWorkerRegistration>,
    private readonly assets: NotificationAssets,
  ) {}

  async notify(notification: ReminderNotification): Promise<void> {
    const registration = await this.registration();
    await registration.showNotification(notification.title, {
      body: notification.body,
      tag: notification.tag,
      icon: this.assets.icon,
      badge: this.assets.badge,
      data: { url: this.assets.openUrl },
    });
  }
}
