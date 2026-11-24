import type {
  ChallengeError,
  DailyChallenge,
  DailyChallengePort,
  ReadingSnapshot,
  ReadingView,
} from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { addDays, longDate, plural } from './format';
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
 * `<hmpt-today-card>` — the day's card, bound as a book.
 *
 * Closed, it waits for a tap. Opening, the camera pulls back to the whole open book — the
 * two days before, side by side — then pushes in while the last of them turns over, and
 * lands on today's page. Logged, the camera pulls back again, today's page turns, and the
 * book is turned over onto its back cover, sealed, with a note from the librarian.
 *
 * The real page is the right-hand page of that book: the camera (a transform on `.tome`)
 * moves it, so the hand-off at either end is seamless. Reduced motion skips the camera.
 */
export class TodayCard extends PortBoundElement {
  #challenge?: DailyChallengePort;
  #busy = false;
  /** The day whose card is waiting, closed, to be opened. */
  #closedDay: string | null = null;
  #playing = false;
  /** The last day and status rendered, to tell a fresh validation from a reload. */
  #seen: { day: string; done: boolean } | null = null;

  protected markup(): string {
    return /* html */ `
      <article class="tome" aria-labelledby="today-pages">
        <div class="tome-boards" aria-hidden="true"></div>
        <div class="tome-left" aria-hidden="true" data-left></div>
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
        <div class="tome-leaf" aria-hidden="true">
          <div class="tome-leaf-front" data-leaf></div>
          <div class="tome-leaf-back"></div>
        </div>
        <button type="button" class="tome-cover" data-open-cover aria-label="Open today’s card">
          <span class="tome-cover-face">
            <span class="tome-cover-eyebrow">Today’s card</span>
            <svg class="tome-cover-emblem" viewBox="0 0 64 44" aria-hidden="true"><path d="M32 8C26 4 18 3 6 4v32c12-1 20 0 26 4 6-4 14-5 26-4V4C46 3 38 4 32 8zM32 8v32M11 12c6-.5 11 .5 15 2.5M11 18c6-.5 11 .5 15 2.5M11 24c6-.5 11 .5 15 2.5M38 14.5c4-2 9-3 15-2.5M38 20.5c4-2 9-3 15-2.5M38 26.5c4-2 9-3 15-2.5"/></svg>
            <span class="tome-cover-date" data-cover-date></span>
            <span class="tome-cover-hint">Tap to open</span>
          </span>
        </button>
        <div class="tome-back" data-back>
          <div class="tome-back-face" role="group" aria-label="Today, read and sealed">
            <span class="tome-back-seal" aria-hidden="true"><span>✓</span></span>
            <p class="tome-back-eyebrow tome-done" role="status">Read, and sealed.</p>
            <p class="tome-back-message" data-message></p>
            <p class="tome-back-summary" data-read></p>
            <p class="tome-back-extra" data-extra></p>
            <button type="button" class="tome-back-open" data-open-book>Open the book</button>
          </div>
          <div class="tome-back-inside" aria-hidden="true"></div>
        </div>
      </article>`;
  }

  protected override setup(): void {
    this.$('[data-complete]').addEventListener('click', () => void this.#run((port) => port.complete()));
    this.$('[data-open-cover]').addEventListener('click', () => void this.#open());
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

  /** The page is out of reach while a board covers it: the front before opening, the back once sealed. */
  #syncInert(): void {
    const covered =
      this.hasAttribute('data-reveal') ||
      this.hasAttribute('data-closing') ||
      (this.hasAttribute('data-done') && !this.hasAttribute('data-peek'));
    this.$('.tome-inner').inert = covered;
  }

  // — opening: closed → the open book, the two days before → today's page ——————————————

  /** A card not yet opened waits closed, its spread laid out beneath the cover. */
  #arrange({ today, history, profile }: ReadingSnapshot): void {
    const waiting = today.unveiledAt === undefined && today.status === 'pending';
    if (!waiting) {
      if (!this.#playing) this.removeAttribute('data-reveal');
      this.#closedDay = null;
      return;
    }
    if (this.#closedDay === today.day) return;
    this.#closedDay = today.day;
    this.$('[data-cover-date]').textContent = longDate(today.day);
    // The spread the camera pulls back to: the two days before today — or, in a brand-new
    // book, its front matter.
    const byDay = new Map(history.map((c) => [c.day, c]));
    const before = addDays(today.day, -2);
    const yesterday = addDays(today.day, -1);
    const fresh = !history.some((c) => c.day < today.day);
    this.$('[data-left]').replaceChildren(
      fresh ? frontMatter('ex-libris', profile?.displayName ?? null) : pastPage(before, byDay.get(before)),
    );
    this.$('[data-leaf]').replaceChildren(fresh ? frontMatter('chapter-one', null) : pastPage(yesterday, byDay.get(yesterday)));
    this.setAttribute('data-reveal', 'closed');
    this.#syncInert();
  }

  async #open(): Promise<void> {
    if (this.#playing || !this.#closedDay) return;
    this.#playing = true;
    const target = Number(this.$('[data-pages]').textContent) || 0;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const number = this.$('[data-pages]');
      const folio = this.$('[data-folio]');
      const show = (n: number) => {
        number.textContent = String(n);
        folio.textContent = `— ${n} —`; // the folio turns with the page
      };
      show(1);
      this.setAttribute('data-reveal', 'opening');
      this.#syncInert();
      await wait(1750); // the cover lifts, the camera pulls back, yesterday's page begins to turn
      await countUp(show, target, 800); // …and the count runs up as the camera pushes in
      this.setAttribute('data-reveal', 'landed');
      await wait(550);
    }
    this.removeAttribute('data-reveal');
    this.#playing = false;
    this.#closedDay = null;
    this.#syncInert();
    await this.#challenge?.unveil();
  }

  // — closing: today's page → the open book → turned over onto the back cover ——————————

  /** The day is logged: the camera pulls back, today's page turns, the book is turned over. */
  #closeBook(): void {
    this.removeAttribute('data-peek');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.$('[data-left]').replaceChildren(verso()); // the back of the page before today's
    this.removeAttribute('data-closing');
    void this.offsetWidth;
    this.setAttribute('data-closing', '');
    setTimeout(() => {
      this.removeAttribute('data-closing');
      this.#syncInert();
    }, 3400);
  }

  #render(snapshot: ReadingSnapshot): void {
    const { today, stats, shelf, achievements } = snapshot;
    this.#arrange(snapshot);
    const done = today.status === 'completed';
    this.toggleAttribute('data-done', done);
    const plate = this.$('.tome-inner hmpt-ds-scene');
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

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** A past day's page, as glimpsed in the open book: its date, its plate, what was read. */
function pastPage(day: string, card: DailyChallenge | undefined): HTMLElement {
  const page = el('div', 'past-page');
  page.append(el('p', 'past-head', longDate(day)));
  const plate = el('div', 'past-plate');
  const frame = document.createElement('frame-pk');
  frame.setAttribute('ratio', '4:3');
  const scene = document.createElement('hmpt-ds-scene');
  scene.setAttribute('seed', String(card?.artSeed ?? hashOf(day)));
  frame.append(scene);
  plate.append(frame);
  page.append(plate);
  if (card?.status === 'completed') {
    const read = card.pagesRead ?? card.pages;
    page.append(el('p', 'past-number', String(read)), el('p', 'past-note', `${plural(read, 'page')} read · sealed`));
  } else if (card) {
    page.append(el('p', 'past-number past-faint', String(card.pages)), el('p', 'past-note', 'pages dealt, left unread'));
  } else {
    page.append(el('p', 'past-number past-faint', '—'), el('p', 'past-note', 'No card that day'));
  }
  return page;
}

/** The front matter of a brand-new book. */
function frontMatter(kind: 'ex-libris' | 'chapter-one', name: string | null): HTMLElement {
  const page = el('div', `past-page past-${kind}`);
  if (kind === 'ex-libris') {
    const plate = el('div', 'past-bookplate');
    plate.append(el('p', 'past-bookplate-title', 'Ex libris'), el('p', 'past-bookplate-name', name ?? 'A new reader'));
    page.append(plate);
  } else {
    page.append(el('p', 'past-chapter-eyebrow', 'Chapter'), el('p', 'past-chapter-title', 'One'), el('p', 'past-ornament', '❦'));
  }
  return page;
}

/** The back of a turned leaf: paper ruled with lines of text. */
const verso = (): HTMLElement => el('div', 'past-page past-verso');
