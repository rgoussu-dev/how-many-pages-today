/*
 * The service worker — a second driving adapter of this deployment unit:
 * - offline-first: every built asset is precached (Workbox injects the manifest);
 * - the scheduled typology: on a periodic background sync it asks the domain whether a
 *   reminder is due, through the very same ReminderCheckPort the page uses.
 */
import { deviceLanguages, mathRandom, systemClock } from '@hmpt/commons';
import { createReminderCheck } from '@hmpt/domain-core';
import { REMINDER_SYNC_TAG, RegistrationNotifier } from '@hmpt/infra-reminders-browser/notifier';
import { openReadingDatabase } from '@hmpt/infra-storage-indexeddb';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { databaseName } from './stage';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null } | string>;
};

/** Periodic Background Sync is Chromium-only and not in the WebWorker lib. */
interface PeriodicSyncEvent extends ExtendableEvent {
  readonly tag: string;
}

const scope = self.registration.scope;

self.addEventListener('install', () => void self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// A staging copy lives under staging/ with its own service worker: never answer its pages
// with this app's shell.
const staging = new RegExp(`^${new URL('staging/', scope).pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [staging] }));

async function checkReminder(): Promise<void> {
  const storage = await openReadingDatabase(databaseName);
  try {
    const check = createReminderCheck({
      history: storage.history,
      profiles: storage.profiles,
      shelves: storage.shelves,
      preferences: storage.preferences,
      notifier: new RegistrationNotifier(async () => self.registration, {
        icon: new URL('icons/icon-192.png', scope).href,
        badge: new URL('icons/badge-96.png', scope).href,
        openUrl: scope,
      }),
      clock: systemClock,
      random: mathRandom,
      languages: deviceLanguages,
    });
    await check.run();
  } finally {
    storage.close();
  }
}

self.addEventListener('periodicsync', (event) => {
  const sync = event as PeriodicSyncEvent;
  if (sync.tag === REMINDER_SYNC_TAG) sync.waitUntil(checkReminder());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url: string = (event.notification.data as { url?: string } | null)?.url ?? scope;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => client.url.startsWith(scope));
      if (open) {
        await open.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
