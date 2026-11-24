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
  /** The day whose card is waiting, face down, to be opened. */
  #sealedDay: string | null = null;
  #playing = false;
  #watchers: Array<() => void> = [];

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
        <div class="tome-leaves" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
        <div class="tome-cover leather" aria-hidden="true">
          <div class="tome-cover-face">
            <p class="tome-cover-eyebrow">Today’s card</p>
            <svg class="tome-cover-emblem" viewBox="0 0 64 44" aria-hidden="true"><path d="M32 8C26 4 18 3 6 4v32c12-1 20 0 26 4 6-4 14-5 26-4V4C46 3 38 4 32 8zM32 8v32M11 12c6-.5 11 .5 15 2.5M11 18c6-.5 11 .5 15 2.5M11 24c6-.5 11 .5 15 2.5M38 14.5c4-2 9-3 15-2.5M38 20.5c4-2 9-3 15-2.5M38 26.5c4-2 9-3 15-2.5"/></svg>
            <p class="tome-cover-date" data-cover-date></p>
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
    return [view.subscribe((snapshot) => this.#render(snapshot)), () => this.#unwatch()];
  }

  // — the daily flourish: the book arrives, opens, and riffles to the day's page ————————

  /** A card not yet opened waits face down until it can be seen. */
  #arrange(today: DailyChallenge): void {
    const waiting = today.unveiledAt === undefined && today.status === 'pending';
    if (!waiting) {
      if (!this.#playing) this.removeAttribute('data-reveal');
      this.#sealedDay = null;
      this.#unwatch();
      return;
    }
    if (this.#sealedDay === today.day) return;
    this.#sealedDay = today.day;
    this.$('[data-cover-date]').textContent = longDate(today.day);
    this.setAttribute('data-reveal', 'closed');
    this.$('.tome-inner').inert = true; // nothing behind the cover is reachable yet
    this.#watch();
  }

  /** Plays once the card is on screen, the page is visible, and no walkthrough is running. */
  #watch(): void {
    this.#unwatch();
    let inView = false;
    const tryPlay = () => {
      const welcoming = document.documentElement.hasAttribute('data-welcoming');
      if (inView && !welcoming && document.visibilityState === 'visible') void this.#play();
    };
    const sight = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting === true && entry.intersectionRatio > 0.35;
      tryPlay();
    }, { threshold: [0, 0.35, 0.6] });
    sight.observe(this);
    const welcome = new MutationObserver(tryPlay);
    welcome.observe(document.documentElement, { attributes: true, attributeFilter: ['data-welcoming'] });
    document.addEventListener('visibilitychange', tryPlay);
    this.#watchers = [
      () => sight.disconnect(),
      () => welcome.disconnect(),
      () => document.removeEventListener('visibilitychange', tryPlay),
    ];
  }

  #unwatch(): void {
    this.#watchers.forEach((stop) => stop());
    this.#watchers = [];
  }

  async #play(): Promise<void> {
    if (this.#playing || !this.#sealedDay) return;
    this.#playing = true;
    this.#unwatch();
    const target = Number(this.$('[data-pages]').textContent) || 0;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still) {
      this.setAttribute('data-reveal', 'opening');
      // The pages riffle past while the cover is open, and the count runs up to the day's page.
      this.$('[data-pages]').textContent = '1';
      await wait(1250);
      await countUp(this.$('[data-pages]'), target, 950);
      this.setAttribute('data-reveal', 'landed');
      await wait(700);
    }
    this.removeAttribute('data-reveal');
    this.$('.tome-inner').inert = false;
    this.#playing = false;
    this.#sealedDay = null;
    await this.#challenge?.unveil();
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
    this.#arrange(today);
    const done = today.status === 'completed';
    this.toggleAttribute('data-done', done);
    this.$('hmpt-ds-scene').setAttribute('seed', String(today.artSeed));
    this.$('[data-date]').textContent = longDate(today.day);
    if (!this.#playing) this.$('[data-pages]').textContent = String(today.pages);
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

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Riffles the number from 1 up to `target`, fast at first, settling at the end. */
function countUp(element: HTMLElement, target: number, duration: number): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      element.textContent = String(Math.max(1, Math.round(eased * target)));
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}
