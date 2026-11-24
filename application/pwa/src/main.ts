/*
 * The assembly point. Everything is constructed here, explicitly, in this order:
 *   1. infrastructure (IndexedDB, service worker, notifications)
 *   2. the domain, from its factories
 *   3. the context provider that hands the driving ports to the elements
 *   4. element definitions — last, because defining upgrades the parsed markup and each
 *      element requests its ports in connectedCallback, synchronously.
 */
import '@rgoussu.dev/planks';
import '@rgoussu.dev/planks/tokens';
import '@hmpt/design-system/fonts.css';
import '@hmpt/design-system/theme.css';
import '@hmpt/elements/elements.css';
import './shell.css';

import { mathRandom, systemClock } from '@hmpt/commons';
import { defineDesignSystem } from '@hmpt/design-system';
import { createReadingApp, type ReadingApp } from '@hmpt/domain-core';
import { defineReadingElements, readingContexts } from '@hmpt/elements';
import { createBrowserInstaller } from '@hmpt/infra-install-browser';
import { BrowserReminderScheduler } from '@hmpt/infra-reminders-browser';
import { RegistrationNotifier } from '@hmpt/infra-reminders-browser/notifier';
import { openReadingDatabase } from '@hmpt/infra-storage-indexeddb';
import { provideContexts, type Context } from '@hmpt/kernel/context';
import { startRouter } from './router';
import { registerServiceWorker } from './service-worker';
import { keepFresh } from './keep-fresh';

const base = import.meta.env.BASE_URL;

// Listen for the install prompt before anything else: it fires once, early.
const installer = createBrowserInstaller();

async function assemble(): Promise<ReadingApp> {
  const worker = registerServiceWorker(`${base}sw.js`);
  const storage = await openReadingDatabase();
  return createReadingApp({
    history: storage.history,
    profiles: storage.profiles,
    shelves: storage.shelves,
    installer,
    preferences: storage.preferences,
    achievements: storage.achievements,
    scheduler: new BrowserReminderScheduler(worker.registration),
    notifier: new RegistrationNotifier(worker.ready, {
      icon: `${base}icons/icon-192.png`,
      badge: `${base}icons/badge-96.png`,
      openUrl: base,
    }),
    clock: systemClock,
    random: mathRandom,
  });
}

async function boot(): Promise<void> {
  const app = await assemble();
  await app.challenge.open(); // the first snapshot exists before any element connects

  provideContexts(
    document,
    new Map<Context<unknown>, unknown>([
      [readingContexts.challenge, app.challenge],
      [readingContexts.profile, app.profile],
      [readingContexts.bookshelf, app.bookshelf],
      [readingContexts.overview, app.overview],
      [readingContexts.welcome, app.welcome],
      [readingContexts.range, app.range],
      [readingContexts.reminder, app.reminder],
      [readingContexts.view, app.view],
    ]),
  );

  defineDesignSystem();
  defineReadingElements();
  startRouter();
  keepFresh(app);
  document.querySelector('[data-booting]')?.removeAttribute('data-booting');
}

boot().catch((error: unknown) => {
  console.error(error);
  const message = document.createElement('p');
  message.className = 'app-fatal';
  message.textContent =
    'Your reading card could not be dealt: this browser blocked local storage (private browsing?). Open the app in a regular window to keep your progress.';
  document.body.replaceChildren(message);
});
