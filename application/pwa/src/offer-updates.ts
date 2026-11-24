import type { AppUpdates } from './service-worker';

/** How often, at most, the app asks the server for a newer version while it is in use. */
const CHECK_EVERY = 10 * 60 * 1000;

/**
 * When a new version of the app has downloaded, the shell offers it: a slip above the tab
 * bar — open it now (the page reloads into it), or later (it opens by itself the next time
 * the app is started afresh). The app looks for a new version whenever it comes back to the
 * foreground, as an installed app may stay open for days.
 */
export function offerUpdates(updates: AppUpdates, root: ParentNode = document): void {
  const slip = root.querySelector<HTMLElement>('[data-update]');
  if (!slip) return;
  updates.onWaiting(() => {
    slip.hidden = false;
  });
  slip.querySelector('[data-update-open]')?.addEventListener('click', () => updates.apply());
  slip.querySelector('[data-update-later]')?.addEventListener('click', () => {
    slip.hidden = true;
  });

  let lastCheck = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < CHECK_EVERY) return;
    lastCheck = Date.now();
    updates.check();
  });
}
