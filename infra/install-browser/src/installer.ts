import type { AppInstaller, InstallAvailability, InstallOutcome } from '@hmpt/domain-contract';

/*
 * `beforeinstallprompt` is Chromium-only and absent from TypeScript's DOM lib.
 * https://developer.mozilla.org/docs/Web/API/BeforeInstallPromptEvent
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Create this as early as possible in the page's life: Chromium fires
 * `beforeinstallprompt` once, soon after load, and an unheard event is lost.
 */
export function createBrowserInstaller(win: Window = window): AppInstaller {
  let deferred: BeforeInstallPromptEvent | null = null;
  let installed = false;

  win.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep the mini-infobar quiet: the walkthrough will offer it
    deferred = event as BeforeInstallPromptEvent;
  });
  win.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
  });

  const standalone = () =>
    win.matchMedia('(display-mode: standalone)').matches ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true;

  const ios = () => {
    const ua = win.navigator.userAgent;
    // iPadOS reports itself as a Mac; the touch points give it away.
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && win.navigator.maxTouchPoints > 1);
  };

  return {
    async availability(): Promise<InstallAvailability> {
      if (installed || standalone()) return 'installed';
      if (deferred) return 'prompt';
      if (ios()) return 'ios';
      return 'manual';
    },

    async prompt(): Promise<InstallOutcome> {
      const event = deferred;
      if (!event) return 'unavailable';
      deferred = null; // a prompt can only be shown once
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === 'accepted') installed = true;
      return outcome;
    },
  };
}
