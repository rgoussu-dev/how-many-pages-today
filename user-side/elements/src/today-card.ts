import type {
  ChallengeError,
  DailyChallenge,
  DailyChallengePort,
  ReadingSnapshot,
  ReadingView,
} from '@hmpt/domain-contract';
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

const ERRORS: Record<ChallengeError, string> = {
  'already-completed': 'Today is already sealed.',
  'not-completed': 'Log your reading first.',
  'invalid-pages': 'A whole number of pages, please — at least one.',
  'invalid-title': 'That title is a little long.',
};

/** What was read, in words: the goal, beyond it, short of it, or a book finished. */
function readingSummary(day: DailyChallenge): string {
  const read = day.pagesRead ?? day.pages;
  const goal = day.pages;
  if (day.finishedBook) return `${plural(read, 'page')} — and a book finished. Bravo.`;
  if (read > goal) return `${read} of ${goal} pages — ${plural(read - goal, 'page')} beyond the goal.`;
  if (read < goal) return `${read} of ${goal} pages. Every page counts.`;
  return `${plural(read, 'page')}, exactly as dealt.`;
}

/**
 * `<hmpt-today-card>` — the day's card, bound like an old book: a leather cover with gilt
 * tooling, an illustrated plate, the goal in gold. One tap logs the goal; the reader may
 * log what they actually read instead, and finish a book along the way. Once logged the
 * card is sealed with wax: final, though more pages may always be added.
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

          <div class="tome-actions" data-pending>
            <button type="button" class="btn btn-gilt btn-block" data-complete>I read them</button>
            <details class="tome-log" data-log>
              <summary>Read more, or fewer?</summary>
              <form novalidate data-log-form>
                <label class="field"><span>Pages actually read</span>
                  <input name="pagesRead" type="number" inputmode="numeric" min="1" max="2000" step="1" required>
                </label>
                <label class="tome-check"><input type="checkbox" name="finishedBook"> <span>I finished my book</span></label>
                <label class="field" data-title-field hidden><span>Which book? <em>(optional)</em></span>
                  <input name="bookTitle" maxlength="120" autocomplete="off" placeholder="Title">
                </label>
                <p class="field-error" data-error="log" role="alert"></p>
                <button class="btn btn-gilt" type="submit">Log my reading</button>
              </form>
            </details>
          </div>

          <div class="tome-actions" data-sealed hidden>
            <p class="tome-done" role="status">Read, and sealed.</p>
            <p class="tome-read" data-read></p>
            <details class="tome-log">
              <summary>Read some more today?</summary>
              <form novalidate data-more-form class="tome-more">
                <label class="field"><span>Pages to add</span>
                  <input name="more" type="number" inputmode="numeric" min="1" max="2000" step="1" required>
                </label>
                <button class="btn btn-gilt" type="submit">Add pages</button>
                <p class="field-error" data-error="more" role="alert"></p>
              </form>
            </details>
          </div>
        </div>
      </article>`;
  }

  protected override setup(): void {
    this.$('[data-complete]').addEventListener('click', () => void this.#run((port) => port.complete()));

    const log = this.$<HTMLFormElement>('[data-log-form]');
    const finished = log.elements.namedItem('finishedBook') as HTMLInputElement;
    finished.addEventListener('change', () => {
      this.$('[data-title-field]').hidden = !finished.checked;
    });
    log.addEventListener('submit', async (event) => {
      event.preventDefault();
      const pagesRead = (log.elements.namedItem('pagesRead') as HTMLInputElement).valueAsNumber;
      const bookTitle = (log.elements.namedItem('bookTitle') as HTMLInputElement).value;
      const error = await this.#run((port) =>
        port.complete({ pagesRead, finishedBook: finished.checked, ...(bookTitle.trim() ? { bookTitle } : {}) }),
      );
      this.$('[data-error="log"]').textContent = error ? ERRORS[error] : '';
    });

    const more = this.$<HTMLFormElement>('[data-more-form]');
    more.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = more.elements.namedItem('more') as HTMLInputElement;
      const error = await this.#run((port) => port.addPages(input.valueAsNumber));
      this.$('[data-error="more"]').textContent = error ? ERRORS[error] : '';
      if (!error) {
        input.value = '';
        this.$<HTMLDetailsElement>('[data-sealed] details').open = false;
      }
    });
  }

  protected connect() {
    this.#challenge = this.request(readingContexts.challenge);
    const view: ReadingView = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
  }

  /** Runs one command at a time; returns the error, if any. */
  async #run(
    action: (port: DailyChallengePort) => Promise<{ ok: true } | { ok: false; error: ChallengeError }>,
  ): Promise<ChallengeError | null> {
    if (this.#busy || !this.#challenge) return null;
    this.#busy = true;
    try {
      const result = await action(this.#challenge);
      return result.ok ? null : result.error;
    } finally {
      this.#busy = false;
    }
  }

  #render({ today, stats, shelf }: ReadingSnapshot): void {
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

    this.$('[data-pending]').hidden = done;
    this.$('[data-sealed]').hidden = !done;
    if (done) {
      this.$('[data-read]').textContent = readingSummary(today);
      return;
    }
    this.$('[data-complete]').textContent = `I read ${plural(today.pages, 'page')}`;
    const log = this.$<HTMLFormElement>('[data-log-form]');
    const pagesInput = log.elements.namedItem('pagesRead') as HTMLInputElement;
    if (!pagesInput.value) pagesInput.value = String(today.pages);
    const titleInput = log.elements.namedItem('bookTitle') as HTMLInputElement;
    titleInput.placeholder = shelf.current ? shelf.current.title : 'Title';
  }
}
