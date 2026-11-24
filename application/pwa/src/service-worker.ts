/** A new version of the app, downloaded and waiting to be opened. */
export interface AppUpdates {
  /** Calls back (once per new version) when one is waiting. */
  onWaiting(callback: () => void): void;
  /** Opens the waiting version: it takes over, and the page reloads into it. */
  apply(): void;
  /** Asks the server whether there is a newer version. */
  check(): void;
}

/** Registers the service worker and hands out its registration to the infra adapters. */
export function registerServiceWorker(url: string): {
  registration: () => Promise<ServiceWorkerRegistration | undefined>;
  ready: () => Promise<ServiceWorkerRegistration>;
  updates: AppUpdates;
} {
  if (!('serviceWorker' in navigator)) {
    return {
      registration: async () => undefined,
      ready: () => Promise.reject(new Error('Service workers are not supported here.')),
      updates: { onWaiting: () => undefined, apply: () => undefined, check: () => undefined },
    };
  }
  const registered = navigator.serviceWorker
    .register(url, { scope: import.meta.env.BASE_URL })
    .catch((error: unknown) => {
      console.warn('Service worker registration failed — the app will not work offline.', error);
      return undefined;
    });

  const listeners: Array<() => void> = [];
  let waiting: ServiceWorker | null = null;
  const announce = (worker: ServiceWorker) => {
    if (worker === waiting) return;
    waiting = worker;
    for (const listener of listeners) listener();
  };
  void registered.then((registration) => {
    if (!registration) return;
    // A version that finished downloading on an earlier visit, still waiting.
    if (registration.waiting && navigator.serviceWorker.controller) announce(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const incoming = registration.installing;
      incoming?.addEventListener('statechange', () => {
        // With no controller this is the first install, not an update: nothing to offer.
        if (incoming.state === 'installed' && navigator.serviceWorker.controller) announce(incoming);
      });
    });
  });

  // Reload once the version the reader chose has taken over — and only then (the first
  // install also takes over the page, and must not reload it).
  let applying = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!applying) return;
    applying = false;
    location.reload();
  });

  return {
    registration: async () => ((await registered) ? navigator.serviceWorker.ready : undefined),
    ready: () => navigator.serviceWorker.ready,
    updates: {
      onWaiting: (callback) => {
        listeners.push(callback);
        if (waiting) callback();
      },
      apply: () => {
        if (!waiting) return;
        applying = true;
        waiting.postMessage({ type: 'skip-waiting' });
      },
      check: () => {
        void registered.then((registration) => registration?.update()).catch(() => undefined); // offline: try again later
      },
    },
  };
}
