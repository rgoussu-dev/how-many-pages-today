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

import { deviceLanguages, mathRandom, systemClock } from '@hmpt/commons';
import { defineDesignSystem } from '@hmpt/design-system';
import { createReadingApp, type ReadingApp } from '@hmpt/domain-core';
import { defineReadingElements, deviceSpeech, readingContexts, speech } from '@hmpt/elements';
import { createBrowserInstaller } from '@hmpt/infra-install-browser';
import { BrowserReminderScheduler } from '@hmpt/infra-reminders-browser';
import { RegistrationNotifier } from '@hmpt/infra-reminders-browser/notifier';
import { openReadingDatabase } from '@hmpt/infra-storage-indexeddb';
import { provideContexts, type Context } from '@hmpt/kernel/context';
import { localizeShell } from './localize-shell';
import { startRouter } from './router';
import { registerServiceWorker } from './service-worker';
import { keepFresh } from './keep-fresh';
import { offerUpdates } from './offer-updates';
import { databaseName, stage } from './stage';

const base = import.meta.env.BASE_URL;

// A staging copy wears a tag in the corner, so it is never mistaken for the real app.
if (stage) document.documentElement.dataset.stage = stage;

// Listen for the install prompt before anything else: it fires once, early.
const installer = createBrowserInstaller();
const worker = registerServiceWorker(`${base}sw.js`);

async function assemble(): Promise<ReadingApp> {
  const storage = await openReadingDatabase(databaseName);
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
    languages: deviceLanguages,
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
      [readingContexts.language, app.language],
      [readingContexts.view, app.view],
    ]),
  );

  // The shell takes the reader's language before the elements upgrade, so they all land in it.
  const words = () => {
    const language = app.view.current()?.language;
    return language ? speech(language) : deviceSpeech();
  };
  const router = startRouter(() => words().t.shell.titles);
  localizeShell(app.view, router);
  defineDesignSystem();
  defineReadingElements();
  keepFresh(app);
  offerUpdates(worker.updates);
  document.querySelector('[data-booting]')?.removeAttribute('data-booting');
}

boot().catch((error: unknown) => {
  console.error(error);
  const message = document.createElement('p');
  message.className = 'app-fatal';
  message.textContent = deviceSpeech().t.shell.fatal;
  document.body.replaceChildren(message);
});
