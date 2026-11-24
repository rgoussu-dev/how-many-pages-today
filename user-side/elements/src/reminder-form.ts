import type { ReadingSnapshot, ReadingView, ReminderPort } from '@hmpt/domain-contract';
import { dailyReminderInvite } from './calendar-invite';
import { readingContexts } from './contexts';
import { deviceSpeech, speech } from './i18n';
import { PortBoundElement } from './port-bound';

/** `<hmpt-reminder-form>` — a daily notification at a fixed hour, plus a calendar fallback. */
export class ReminderForm extends PortBoundElement {
  #reminder?: ReminderPort;
  #view?: ReadingView;
  #dirty = false;

  protected markup(): string {
    return /* html */ `
      <section class="surface" aria-labelledby="reminder-title">
        <box-pk padding="var(--s1)">
          <form novalidate>
            <stack-pk space="var(--s0)">
              <div>
                <h2 id="reminder-title" data-t="reminder.heading"></h2>
                <p class="muted" data-t="reminder.intro"></p>
              </div>
              <label class="switch"><span data-t="reminder.everyDay"></span><input type="checkbox" name="enabled" role="switch"></label>
              <label class="field"><span data-t="reminder.at"></span><input type="time" name="time" required></label>
              <cluster-pk space="var(--s-1)" align="center">
                <button class="btn btn-primary" type="submit" data-t="reminder.save"></button>
                <button class="btn" type="button" data-test data-t="reminder.test"></button>
              </cluster-pk>
              <p class="status" role="status" data-status></p>
              <details class="reminder-help">
                <summary data-t="reminder.neverMisses"></summary>
                <stack-pk space="var(--s-1)">
                  <p class="muted" data-t="reminder.help"></p>
                  <button class="btn" type="button" data-ics data-t="reminder.calendar"></button>
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
      const { t } = this.#words();
      if (!result.ok) return this.#status(t.reminder.errors[result.error], 'warn');
      this.#dirty = false;
      const { settings, delivery } = result.value;
      this.#status(
        !settings.enabled
          ? t.reminder.off
          : delivery === 'background'
            ? t.reminder.background(settings.time)
            : t.reminder.whileOpen(settings.time),
        'ok',
      );
    });
    this.$('[data-test]').addEventListener('click', async () => {
      if (!this.#reminder) return;
      const result = await this.#reminder.sendTest();
      const { t } = this.#words();
      this.#status(result.ok ? t.reminder.testSent : t.reminder.errors[result.error], result.ok ? 'ok' : 'warn');
    });
    this.$('[data-ics]').addEventListener('click', () => this.#downloadInvite());
  }

  protected connect() {
    this.#reminder = this.request(readingContexts.reminder);
    this.#view = this.request(readingContexts.view);
    return [this.#view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #words() {
    const language = this.#view?.current()?.language;
    return language ? speech(language) : deviceSpeech();
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
    const { invite } = this.#words().t.reminder;
    const wording = { summary: invite.summary, description: invite.description(appUrl), alarm: invite.alarm };
    const blob = new Blob([dailyReminderInvite(time || '20:00', appUrl, wording)], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = invite.file;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  }

  #render({ reminder, language }: ReadingSnapshot): void {
    this.speak(language);
    if (this.#dirty) return;
    const form = this.$<HTMLFormElement>('form');
    (form.elements.namedItem('enabled') as HTMLInputElement).checked = reminder.enabled;
    (form.elements.namedItem('time') as HTMLInputElement).value = reminder.time;
  }
}
