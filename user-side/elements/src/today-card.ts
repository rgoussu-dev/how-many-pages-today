import type { DailyChallengePort, ReadingSnapshot, ReadingView } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { longDate, plural } from './format';
import { PortBoundElement } from './port-bound';

const HINTS_PENDING = [
  'Find a cosy corner. The pages will not read themselves.',
  'A chapter with a cup of something warm?',
  'Phone down, book up.',
  'Every page counts. These ones especially.',
  'Your future self is already thanking you.',
];

/** `<hmpt-today-card>` — the day's card: an illustration, a number of pages, a button. */
export class TodayCard extends PortBoundElement {
  #challenge?: DailyChallengePort;
  #busy = false;

  protected markup(): string {
    return /* html */ `
      <article class="today surface" aria-labelledby="today-pages">
        <div class="today-art">
          <frame-pk ratio="4:3"><hmpt-ds-scene></hmpt-ds-scene></frame-pk>
          <span class="today-stamp" aria-hidden="true">Read ✓</span>
        </div>
        <box-pk padding="var(--s1)" class="today-body">
          <stack-pk space="var(--s-1)">
            <p class="eyebrow" data-date>Today</p>
            <p class="today-pages" id="today-pages">
              <span class="today-number" data-pages>…</span>
              <span class="today-unit" data-unit>pages</span>
            </p>
            <p class="muted" data-hint></p>
            <stack-pk space="var(--s-2)" class="today-actions">
              <button type="button" class="btn btn-primary btn-block" data-complete>I read them</button>
              <button type="button" class="btn btn-quiet" data-undo hidden>Not quite — undo</button>
            </stack-pk>
          </stack-pk>
        </box-pk>
      </article>`;
  }

  protected override setup(): void {
    this.$('[data-complete]').addEventListener('click', () => this.#run((port) => port.complete()));
    this.$('[data-undo]').addEventListener('click', () => this.#run((port) => port.undo()));
  }

  protected connect() {
    this.#challenge = this.request(readingContexts.challenge);
    const view: ReadingView = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
  }

  async #run(action: (port: DailyChallengePort) => Promise<unknown>): Promise<void> {
    if (this.#busy || !this.#challenge) return;
    this.#busy = true;
    try {
      await action(this.#challenge);
    } finally {
      this.#busy = false;
    }
  }

  #render({ today, stats }: ReadingSnapshot): void {
    const done = today.status === 'completed';
    this.toggleAttribute('data-done', done);
    this.$('hmpt-ds-scene').setAttribute('seed', String(today.artSeed));
    this.$('[data-date]').textContent = longDate(today.day);
    this.$('[data-pages]').textContent = String(today.pages);
    this.$('[data-unit]').textContent = today.pages === 1 ? 'page' : 'pages';
    this.$('[data-hint]').textContent = done
      ? stats.currentStreak > 1
        ? `Done for today — ${plural(stats.currentStreak, 'day')} in a row. See you tomorrow!`
        : 'Done for today. A fresh card awaits tomorrow.'
      : (HINTS_PENDING[today.artSeed % HINTS_PENDING.length] ?? '');
    const complete = this.$<HTMLButtonElement>('[data-complete]');
    complete.hidden = done;
    complete.textContent = `I read ${plural(today.pages, 'page')}`;
    this.$<HTMLButtonElement>('[data-undo]').hidden = !done;
  }
}
