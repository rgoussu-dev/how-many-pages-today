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

const NOTES = {
  met: [
    'Well read. The day is yours.',
    'Every page accounted for. Splendid.',
    'A quiet triumph. The lamp may rest.',
    'That is how a habit is bound: one page at a time.',
    'The librarian nods, approvingly, over the spectacles.',
    'Another day written into the ledger. Bravo.',
  ],
  beyond: [
    'Beyond the bookmark — the story simply would not let you go.',
    'Just one more chapter, was it? Splendid.',
    'You read past the goal. A very fine sign.',
    'More than was asked. The shelves are impressed.',
  ],
  short: [
    'Every page counts — and these did.',
    'A short chapter is still a chapter. The candle stays lit.',
    'Some days are slim volumes. Tomorrow is a new page.',
    'A little reading is still reading. Well done for coming.',
  ],
  book: [
    'The last page, turned. What a thing.',
    'The end — and on to the next beginning.',
    'Another book for the shelf. The librarian is delighted.',
  ],
} as const;

const hashOf = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** A warm note for the back cover — chosen by chance, but the same all day. */
function backCoverNote(day: DailyChallenge, bookTitle: string | null): string {
  const read = day.pagesRead ?? day.pages;
  const kind = day.finishedBook ? 'book' : read > day.pages ? 'beyond' : day.goalMet === false ? 'short' : 'met';
  const pool = NOTES[kind];
  const note = pool[hashOf(`${day.day}:${kind}`) % pool.length] ?? pool[0];
  // The summary beneath already says how many pages: the note only says how it felt.
  return kind === 'book' && bookTitle ? `“${bookTitle}” — finished. ${note}` : note;
}

function backCoverExtra(streak: number, achievements: ReadingSnapshot['achievements'], day: string): string {
  const earned = achievements.filter((a) => a.unlockedOn === day).map((a) => a.title);
  if (earned.length === 1) return `New bookplate: ${earned[0]}`;
  if (earned.length > 1) return `${earned.length} new bookplates today`;
  return streak > 1 ? `${streak} days in a row` : '';
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
  /** The last day and status rendered, to tell a fresh validation from a reload. */
  #seen: { day: string; done: boolean } | null = null;

  protected markup(): string {
    return /* html */ `
      <article class="tome" aria-labelledby="today-pages">
        <div class="tome-inner">
          <p class="tome-date" data-date>Today</p>
          <div class="tome-plate">
            <frame-pk ratio="4:3"><hmpt-ds-scene></hmpt-ds-scene></frame-pk>
          </div>
          <p class="tome-caption" data-caption></p>
          <p class="tome-pages" id="today-pages">
            <span class="tome-number" data-pages>…</span>
            <span class="tome-unit" data-unit>pages</span>
          </p>
          <p class="tome-hint" data-hint></p>

          <div class="tome-actions" data-pending>
            <button type="button" class="btn btn-primary btn-block" data-complete>I read them</button>
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
                <button class="btn btn-primary" type="submit">Log my reading</button>
              </form>
            </details>
          </div>

          <div class="tome-actions" data-sealed hidden>
            <p class="tome-read" data-read-page></p>
            <details class="tome-log">
              <summary>Read some more today?</summary>
              <form novalidate data-more-form class="tome-more">
                <label class="field"><span>Pages to add</span>
                  <input name="more" type="number" inputmode="numeric" min="1" max="2000" step="1" required>
                </label>
                <button class="btn btn-primary" type="submit">Add pages</button>
                <p class="field-error" data-error="more" role="alert"></p>
              </form>
            </details>
            <button type="button" class="btn btn-quiet" data-close-book>Close the book</button>
          </div>
          <p class="tome-folio" aria-hidden="true" data-folio></p>
        </div>
        <div class="tome-leaves" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
        <div class="tome-cover leather" aria-hidden="true">
          <div class="tome-cover-face">
            <p class="tome-cover-eyebrow">Today’s card</p>
            <svg class="tome-cover-emblem" viewBox="0 0 64 44" aria-hidden="true"><path d="M32 8C26 4 18 3 6 4v32c12-1 20 0 26 4 6-4 14-5 26-4V4C46 3 38 4 32 8zM32 8v32M11 12c6-.5 11 .5 15 2.5M11 18c6-.5 11 .5 15 2.5M11 24c6-.5 11 .5 15 2.5M38 14.5c4-2 9-3 15-2.5M38 20.5c4-2 9-3 15-2.5M38 26.5c4-2 9-3 15-2.5"/></svg>
            <p class="tome-cover-date" data-cover-date></p>
          </div>
        </div>
        <div class="tome-back leather" data-back>
          <div class="tome-back-face" role="group" aria-label="Today, read and sealed">
            <span class="tome-back-seal" aria-hidden="true"><span>✓</span></span>
            <p class="tome-back-eyebrow tome-done" role="status">Read, and sealed.</p>
            <p class="tome-back-message" data-message></p>
            <p class="tome-back-summary" data-read></p>
            <p class="tome-back-extra" data-extra></p>
            <button type="button" class="tome-back-open" data-open-book>Open the book</button>
          </div>
        </div>
      </article>`;
  }

  protected override setup(): void {
    this.$('[data-complete]').addEventListener('click', () => void this.#run((port) => port.complete()));
    this.$('[data-open-book]').addEventListener('click', () => {
      this.setAttribute('data-peek', '');
      this.#syncInert();
      this.$<HTMLElement>('[data-close-book]').focus();
    });
    this.$('[data-close-book]').addEventListener('click', () => {
      this.removeAttribute('data-peek');
      this.#syncInert();
      this.$<HTMLElement>('[data-open-book]').focus();
    });

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

  /** The day is logged: the back board swings shut over the page and the seal is pressed. */
  #closeBook(): void {
    this.removeAttribute('data-peek');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.removeAttribute('data-closing');
    void this.offsetWidth;
    this.setAttribute('data-closing', '');
    setTimeout(() => this.removeAttribute('data-closing'), 1800);
  }

  // — the daily flourish: the book arrives, opens, and riffles to the day's page ————————

  /** The page is out of reach while a board covers it: the front before opening, the back once sealed. */
  #syncInert(): void {
    const covered = this.hasAttribute('data-reveal') || (this.hasAttribute('data-done') && !this.hasAttribute('data-peek'));
    this.$('.tome-inner').inert = covered;
  }

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
    this.#syncInert(); // nothing behind the cover is reachable yet
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
      const number = this.$('[data-pages]');
      const folio = this.$('[data-folio]');
      const show = (n: number) => {
        number.textContent = String(n);
        folio.textContent = `— ${n} —`; // the folio turns with the leaves
      };
      show(1);
      await wait(1250);
      await countUp(show, target, 950);
      this.setAttribute('data-reveal', 'landed');
      await wait(700);
    }
    this.removeAttribute('data-reveal');
    this.#playing = false;
    this.#syncInert();
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

  #render({ today, stats, shelf, achievements }: ReadingSnapshot): void {
    this.#arrange(today);
    const done = today.status === 'completed';
    this.toggleAttribute('data-done', done);
    const plate = this.$('hmpt-ds-scene');
    plate.setAttribute('seed', String(today.artSeed));
    // The plate's caption, as in an illustrated book: the scene's own description.
    this.$('[data-caption]').textContent = plate.getAttribute('aria-label') ?? '';
    this.$('[data-date]').textContent = longDate(today.day);
    if (!this.#playing) {
      this.$('[data-pages]').textContent = String(today.pages);
      this.$('[data-folio]').textContent = `— ${today.pages} —`;
    }
    this.$('[data-unit]').textContent = today.pages === 1 ? 'page' : 'pages';
    this.$('[data-hint]').textContent = done
      ? stats.currentStreak > 1
        ? `${plural(stats.currentStreak, 'day')} in a row. A fresh card awaits tomorrow.`
        : 'A fresh card awaits tomorrow.'
      : (HINTS_PENDING[today.artSeed % HINTS_PENDING.length] ?? '');

    this.$('[data-pending]').hidden = done;
    this.$('[data-sealed]').hidden = !done;
    const justSealed = done && this.#seen?.day === today.day && this.#seen.done === false;
    this.#seen = { day: today.day, done };
    if (done) {
      const summary = readingSummary(today);
      this.$('[data-read]').textContent = summary;
      this.$('[data-read-page]').textContent = summary;
      this.$('[data-message]').textContent = backCoverNote(today, shelf.finished.at(-1)?.title ?? null);
      this.$('[data-extra]').textContent = backCoverExtra(stats.currentStreak, achievements, today.day);
      if (justSealed) this.#closeBook();
      this.#syncInert();
      return;
    }
    this.removeAttribute('data-peek');
    this.#syncInert();
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
function countUp(show: (n: number) => void, target: number, duration: number): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      show(Math.max(1, Math.round(eased * target)));
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}
