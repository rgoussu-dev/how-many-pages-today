/** Registers the service worker and hands out its registration to the infra adapters. */
export function registerServiceWorker(url: string): {
  registration: () => Promise<ServiceWorkerRegistration | undefined>;
  ready: () => Promise<ServiceWorkerRegistration>;
} {
  if (!('serviceWorker' in navigator)) {
    return {
      registration: async () => undefined,
      ready: () => Promise.reject(new Error('Service workers are not supported here.')),
    };
  }
  const registered = navigator.serviceWorker
    .register(url, { scope: import.meta.env.BASE_URL })
    .catch((error: unknown) => {
      console.warn('Service worker registration failed — the app will not work offline.', error);
      return undefined;
    });
  return {
    registration: async () => (await registered) ? navigator.serviceWorker.ready : undefined,
    ready: () => navigator.serviceWorker.ready,
  };
}
