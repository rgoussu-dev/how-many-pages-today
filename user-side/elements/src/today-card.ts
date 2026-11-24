import type { DailyChallengePort, ReadingSnapshot, ReadingView } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { longDate, plural } from './format';
import { PortBoundElement } from './port-bound';

const HINTS_PENDING = [
  'Find a cosy corner. The pages will not read themselves.',
  'A blanket, a cup of tea, and these pages.',
  'The armchair has been waiting all day.',
  'Phone down, book up.',
  'Light the lamp; the rest will follow.',
  'Every page counts. These ones especially.',
];

/**
 * `<hmpt-today-card>` — the day's card, bound like an old book: a leather cover with
 * gilt tooling, an illustrated plate, the number of pages in gold. Once read, it is
 * sealed with wax. Validation is deliberate and final.
 */
export class TodayCard extends PortBoundElement {
  #challenge?: DailyChallengePort;
  #busy = false;

  protected markup(): string {
    return /* html */ `
      <article class="tome leather" aria-labelledby="today-pages">
        <div class="tome-inner">
          <p class="tome-date" data-date>Today</p>
          <div class="tome-plate">
            <frame-pk ratio="4:3"><hmpt-ds-scene></hmpt-ds-scene></frame-pk>
            <span class="tome-seal" aria-hidden="true"><span>✓</span></span>
          </div>
          <p class="tome-pages" id="today-pages">
            <span class="tome-number gilt-text" data-pages>…</span>
            <span class="tome-unit" data-unit>pages</span>
          </p>
          <p class="tome-hint" data-hint></p>
          <button type="button" class="btn btn-gilt btn-block" data-complete>I read them</button>
          <p class="tome-done" data-done-note hidden role="status">Read, and sealed.</p>
        </div>
      </article>`;
  }

  protected override setup(): void {
    this.$('[data-complete]').addEventListener('click', async () => {
      if (this.#busy || !this.#challenge) return;
      this.#busy = true;
      try {
        await this.#challenge.complete();
      } finally {
        this.#busy = false;
      }
    });
  }

  protected connect() {
    this.#challenge = this.request(readingContexts.challenge);
    const view: ReadingView = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
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
        ? `${plural(stats.currentStreak, 'day')} in a row. A fresh card awaits tomorrow.`
        : 'A fresh card awaits tomorrow.'
      : (HINTS_PENDING[today.artSeed % HINTS_PENDING.length] ?? '');
    const complete = this.$<HTMLButtonElement>('[data-complete]');
    complete.hidden = done;
    complete.textContent = `I read ${plural(today.pages, 'page')}`;
    this.$('[data-done-note]').hidden = !done;
  }
}
