import type { ReadingSnapshot, ReminderError, ReminderPort } from '@hmpt/domain-contract';
import { dailyReminderInvite } from './calendar-invite';
import { readingContexts } from './contexts';
import { PortBoundElement } from './port-bound';

const ERRORS: Record<ReminderError, string> = {
  'invalid-time': 'Pick a time, like 20:30.',
  'permission-denied':
    'Notifications are blocked for this app. Allow them in your browser or phone settings, then try again.',
  unsupported:
    'This browser cannot show notifications here. On iPhone and iPad, add the app to your Home Screen first. The calendar reminder below works everywhere.',
  'delivery-failed': 'The notification could not be shown on this device. The calendar reminder below works everywhere.',
};

/** `<hmpt-reminder-form>` — a daily notification at a fixed hour, plus a calendar fallback. */
export class ReminderForm extends PortBoundElement {
  #reminder?: ReminderPort;
  #dirty = false;

  protected markup(): string {
    return /* html */ `
      <section class="surface" aria-labelledby="reminder-title">
        <box-pk padding="var(--s1)">
          <form novalidate>
            <stack-pk space="var(--s0)">
              <div>
                <h2 id="reminder-title">Daily reminder</h2>
                <p class="muted">A nudge at the same hour every day, until you have read your pages.</p>
              </div>
              <label class="switch"><span>Remind me every day</span><input type="checkbox" name="enabled" role="switch"></label>
              <label class="field"><span>At</span><input type="time" name="time" required></label>
              <cluster-pk space="var(--s-1)" align="center">
                <button class="btn btn-primary" type="submit">Save reminder</button>
                <button class="btn" type="button" data-test>Send a test</button>
              </cluster-pk>
              <p class="status" role="status" data-status></p>
              <details class="reminder-help">
                <summary>Want a reminder that never misses?</summary>
                <stack-pk space="var(--s-1)">
                  <p class="muted">This app runs entirely on your phone, with no server. Android (Chrome) can wake it in the background — at roughly the hour you chose. iPhone only shows reminders while the app is open. For a reminder that rings on the dot, add it to your calendar:</p>
                  <button class="btn" type="button" data-ics>📅 Add to my calendar</button>
                </stack-pk>
              </details>
            </stack-pk>
          </form>
        </box-pk>
      </section>`;
  }

  protected override setup(): void {
    const form = this.$<HTMLFormElement>('form');
    form.addEventListener('input', () => (this.#dirty = true));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#reminder) return;
      const result = await this.#reminder.configure(this.#read());
      if (!result.ok) return this.#status(ERRORS[result.error], 'warn');
      this.#dirty = false;
      const { settings, delivery } = result.value;
      this.#status(
        !settings.enabled
          ? 'Reminder off.'
          : delivery === 'background'
            ? `Saved ✓ — you will be nudged around ${settings.time}, even with the app closed.`
            : `Saved ✓ — you will be nudged at ${settings.time} while the app is open. Add it to your calendar for a sure thing.`,
        'ok',
      );
    });
    this.$('[data-test]').addEventListener('click', async () => {
      if (!this.#reminder) return;
      const result = await this.#reminder.sendTest();
      this.#status(result.ok ? 'Test sent — check your notifications.' : ERRORS[result.error], result.ok ? 'ok' : 'warn');
    });
    this.$('[data-ics]').addEventListener('click', () => this.#downloadInvite());
  }

  protected connect() {
    this.#reminder = this.request(readingContexts.reminder);
    const view = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #read(): { enabled: boolean; time: string } {
    const form = this.$<HTMLFormElement>('form');
    return {
      enabled: (form.elements.namedItem('enabled') as HTMLInputElement).checked,
      time: (form.elements.namedItem('time') as HTMLInputElement).value,
    };
  }

  #status(message: string, tone: 'ok' | 'warn'): void {
    const status = this.$('[data-status]');
    status.dataset.tone = tone;
    status.textContent = message;
  }

  #downloadInvite(): void {
    const { time } = this.#read();
    const appUrl = `${location.origin}${location.pathname}`;
    const blob = new Blob([dailyReminderInvite(time || '20:00', appUrl)], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'daily-reading-reminder.ics';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  }

  #render({ reminder }: ReadingSnapshot): void {
    if (this.#dirty) return;
    const form = this.$<HTMLFormElement>('form');
    (form.elements.namedItem('enabled') as HTMLInputElement).checked = reminder.enabled;
    (form.elements.namedItem('time') as HTMLInputElement).value = reminder.time;
  }
}
