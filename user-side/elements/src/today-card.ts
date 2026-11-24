import type {
  BookInHand,
  BookshelfPort,
  ChallengeError,
  DailyChallenge,
  DailyChallengePort,
  ReadingSnapshot,
  ReadingView,
} from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { addDays } from './format';
import { deviceSpeech, speech, type Messages, type Speech } from './i18n';
import { PortBoundElement } from './port-bound';

/** What was read, in words: the goal, beyond it, short of it, or a book finished. */
function readingSummary(day: DailyChallenge, t: Messages): string {
  const read = day.pagesRead ?? day.pages;
  const goal = day.pages;
  if (day.finishedBook) return t.card.summary.book(read);
  if (read > goal) return t.card.summary.beyond(read, goal);
  if (read < goal) return t.card.summary.short(read, goal);
  return t.card.summary.exact(read);
}

const hashOf = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** A warm note for the back cover — chosen by chance, but the same all day. */
function backCoverNote(day: DailyChallenge, bookTitle: string | null, t: Messages): string {
  const read = day.pagesRead ?? day.pages;
  const kind = day.finishedBook ? 'book' : read > day.pages ? 'beyond' : day.goalMet === false ? 'short' : 'met';
  const pool = t.card.notes[kind];
  const note = pool[hashOf(`${day.day}:${kind}`) % pool.length] ?? pool[0] ?? '';
  // The summary beneath already says how many pages: the note only says how it felt.
  return kind === 'book' && bookTitle ? t.card.bookFinishedNote(bookTitle, note) : note;
}

function backCoverExtra(streak: number, achievements: ReadingSnapshot['achievements'], day: string, t: Messages): string {
  const earned = achievements.filter((a) => a.unlockedOn === day);
  if (earned.length === 1) return t.card.newBookplate(t.achievements.list[earned[0]!.id].title);
  if (earned.length > 1) return t.card.newBookplates(earned.length);
  return streak > 1 ? t.card.inARow(streak) : '';
}

/**
 * `<hmpt-today-card>` — the day's card, bound as a book.
 *
 * Closed, it waits for a tap. Opening, the camera pulls back to the closed book, which falls
 * open at the middle — the two days before, side by side — then pushes in while the last
 * of them turns over, and lands on today's page. Logged, the camera pulls back again, today's page turns, and the
 * book is turned over onto its back cover, sealed, with a note from the librarian.
 *
 * Each half of the book is a panel hinged at the spine (x = 0 of the card): the left half is
 * the front board with a page on its inside; the right half is the real page, the leaves on
 * it and, underneath, the back board. The camera is a transform on `.tome`, so the hand-off
 * to the real page (and to the back cover) is seamless. Reduced motion skips the camera.
 */
export class TodayCard extends PortBoundElement {
  #challenge?: DailyChallengePort;
  #shelf?: BookshelfPort;
  #view?: ReadingView;
  #busy = false;
  /** The day whose card is waiting, closed, to be opened. */
  #closedDay: string | null = null;
  /** The day and language the closed book was laid out in. */
  #laidOut = '';
  #playing = false;
  #turning: ReturnType<typeof setTimeout> | undefined;
  /** The last day and status rendered, to tell a fresh validation from a reload. */
  #seen: { day: string; done: boolean } | null = null;

  protected markup(): string {
    return /* html */ `
      <div class="tome-camera">
      <!-- The open book's boards: a flat backdrop behind the 3D scene, never sorted into it. -->
      <div class="tome-boards" aria-hidden="true"></div>
      <article class="tome" aria-labelledby="today-pages">
        <!-- The right half's page block: its edges, so the book is a solid, not a sheet. -->
        <div class="tome-solid tome-solid-right" aria-hidden="true">
          <i class="tome-edge tome-edge-fore"></i><i class="tome-edge tome-edge-head"></i><i class="tome-edge tome-edge-tail"></i>
        </div>
        <div class="tome-inner">
          <p class="tome-date" data-date></p>
          <div class="tome-plate">
            <frame-pk ratio="4:3"><hmpt-ds-scene></hmpt-ds-scene></frame-pk>
          </div>
          <p class="tome-caption" data-caption></p>
          <p class="tome-pages" id="today-pages">
            <span class="tome-number" data-pages>…</span>
            <span class="tome-unit" data-unit></span>
          </p>
          <p class="tome-until" data-until hidden><span class="ribbon" aria-hidden="true"></span><span data-until-text></span></p>
          <p class="tome-hint" data-hint></p>

          <div class="tome-actions" data-pending>
            <button type="button" class="btn btn-primary btn-block" data-complete></button>
            <a class="tome-place" href="#progress" data-place hidden data-t="card.placeBookmark"></a>
            <details class="tome-log" data-log>
              <summary data-t="card.readMore"></summary>
              <form novalidate data-log-form>
                <label class="field"><span data-t="card.pagesRead"></span>
                  <input name="pagesRead" type="number" inputmode="numeric" min="1" max="2000" step="1" required>
                </label>
                <label class="tome-check"><input type="checkbox" name="finishedBook"> <span data-t="card.finishedBook"></span></label>
                <label class="field" data-title-field hidden><span><span data-t="card.whichBook"></span> <em data-t="common.optional"></em></span>
                  <input name="bookTitle" maxlength="120" autocomplete="off">
                </label>
                <p class="field-error" data-error="log" role="alert"></p>
                <button class="btn btn-primary" type="submit" data-t="card.logReading"></button>
              </form>
            </details>
          </div>

          <div class="tome-actions" data-sealed hidden>
            <p class="tome-read" data-read-page></p>
            <p class="tome-until" data-bookmark-line hidden><span class="ribbon" aria-hidden="true"></span><span data-bookmark-text></span></p>
            <div class="tome-last-page" data-last-page hidden>
              <p data-last-page-text></p>
              <button type="button" class="btn btn-primary" data-shelve data-t="card.shelveIt"></button>
            </div>
            <details class="tome-log">
              <summary data-t="card.readSomeMore"></summary>
              <form novalidate data-more-form class="tome-more">
                <label class="field"><span data-t="card.pagesToAdd"></span>
                  <input name="more" type="number" inputmode="numeric" min="1" max="2000" step="1" required>
                </label>
                <button class="btn btn-primary" type="submit" data-t="card.addPages"></button>
                <p class="field-error" data-error="more" role="alert"></p>
              </form>
            </details>
            <button type="button" class="btn btn-quiet" data-close-book data-t="card.closeBook"></button>
          </div>
          <p class="tome-folio" aria-hidden="true" data-folio></p>
        </div>
        <!-- The book's own bookmark, lying on today's page under the leaves, its top standing out of the
             book. Its holder is hinged at the spine like the rest of the right half, and turns with it. -->
        <div class="tome-marker" data-marker>
          <hmpt-ds-bookmark class="tome-bookmark" role="img" data-bookmark hidden></hmpt-ds-bookmark>
        </div>
        <!-- A few leaves between the two days before and today: they riffle over as the camera pushes in. -->
        <div class="tome-leaves" aria-hidden="true">
          <div class="tome-leaf"><div class="tome-leaf-front" data-leaf></div><div class="tome-leaf-back"></div></div>
          <div class="tome-leaf"><div class="tome-leaf-front tome-leaf-ruled"></div><div class="tome-leaf-back"></div></div>
          <div class="tome-leaf"><div class="tome-leaf-front tome-leaf-ruled"></div><div class="tome-leaf-back"></div></div>
        </div>
        <div class="tome-cover" data-open-cover role="button" tabindex="0" data-t-label="card.openCover">
          <span class="tome-cover-face">
            <span class="tome-cover-eyebrow" data-t="card.coverEyebrow"></span>
            <svg class="tome-cover-emblem" viewBox="0 0 64 44" aria-hidden="true"><path d="M32 8C26 4 18 3 6 4v32c12-1 20 0 26 4 6-4 14-5 26-4V4C46 3 38 4 32 8zM32 8v32M11 12c6-.5 11 .5 15 2.5M11 18c6-.5 11 .5 15 2.5M11 24c6-.5 11 .5 15 2.5M38 14.5c4-2 9-3 15-2.5M38 20.5c4-2 9-3 15-2.5M38 26.5c4-2 9-3 15-2.5"/></svg>
            <span class="tome-cover-date" data-cover-date></span>
            <span class="tome-cover-hint" data-t="card.tapToOpen"></span>
          </span>
          <!-- The book falls open from the middle: this half carries the day before yesterday's page. -->
          <div class="tome-cover-back" aria-hidden="true" data-cover-back></div>
          <i class="tome-edge tome-edge-fore" aria-hidden="true"></i><i class="tome-edge tome-edge-head" aria-hidden="true"></i><i class="tome-edge tome-edge-tail" aria-hidden="true"></i>
          <span class="tome-board" aria-hidden="true"><i class="tome-board-under"></i><i class="tome-board-fore"></i><i class="tome-board-head"></i><i class="tome-board-tail"></i><i class="tome-board-arc tome-board-arc-0"></i><i class="tome-board-arc tome-board-arc-1"></i><i class="tome-board-arc tome-board-arc-2"></i><i class="tome-board-arc tome-board-arc-3"></i><i class="tome-board-arc tome-board-arc-4"></i><i class="tome-board-arc tome-board-arc-5"></i></span>
        </div>
        <div class="tome-back" data-back>
          <span class="tome-board" aria-hidden="true"><i class="tome-board-under"></i><i class="tome-board-fore"></i><i class="tome-board-head"></i><i class="tome-board-tail"></i><i class="tome-board-arc tome-board-arc-0"></i><i class="tome-board-arc tome-board-arc-1"></i><i class="tome-board-arc tome-board-arc-2"></i><i class="tome-board-arc tome-board-arc-3"></i><i class="tome-board-arc tome-board-arc-4"></i><i class="tome-board-arc tome-board-arc-5"></i></span>
          <div class="tome-back-face" role="group" data-t-label="card.sealedGroup">
            <span class="tome-back-seal" aria-hidden="true"><span>✓</span></span>
            <p class="tome-back-eyebrow tome-done" role="status" data-t="card.sealed"></p>
            <p class="tome-back-message" data-message></p>
            <p class="tome-back-summary" data-read></p>
            <p class="tome-back-extra" data-extra></p>
            <p class="tome-back-bookmark" data-back-bookmark hidden><span class="ribbon" aria-hidden="true"></span><span data-back-bookmark-text></span></p>
            <button type="button" class="tome-back-open" data-open-book data-t="card.openBook"></button>
          </div>
        </div>
      </article>
      </div>`;
  }

  protected override setup(): void {
    this.$('[data-complete]').addEventListener('click', () => void this.#run((port) => port.complete()));
    this.$('[data-shelve]').addEventListener('click', () => void this.#shelf?.finishBook());
    const cover = this.$('[data-open-cover]');
    cover.addEventListener('click', () => void this.#open());
    cover.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void this.#open();
      }
    });
    // Reopening after the day is read: the closing, rewound; closing it again: the closing,
    // replayed. Both a little quicker than the first time, and the seal is not pressed twice.
    this.$('[data-open-book]').addEventListener('click', () => {
      this.setAttribute('data-peek', '');
      this.#turn('reopen', () => this.$<HTMLElement>('[data-close-book]').focus());
    });
    this.$('[data-close-book]').addEventListener('click', () => {
      this.removeAttribute('data-peek');
      this.#turn('again', () => this.$<HTMLElement>('[data-open-book]').focus());
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
      this.$('[data-error="log"]').textContent = error ? this.#words().t.card.errors[error] : '';
    });

    const more = this.$<HTMLFormElement>('[data-more-form]');
    more.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = more.elements.namedItem('more') as HTMLInputElement;
      const error = await this.#run((port) => port.addPages(input.valueAsNumber));
      this.$('[data-error="more"]').textContent = error ? this.#words().t.card.errors[error] : '';
      if (!error) {
        input.value = '';
        this.$<HTMLDetailsElement>('[data-sealed] details').open = false;
      }
    });
  }

  protected connect() {
    this.#challenge = this.request(readingContexts.challenge);
    this.#shelf = this.request(readingContexts.bookshelf);
    this.#view = this.request(readingContexts.view);
    return [this.#view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #words(): Speech {
    const language = this.#view?.current()?.language;
    return language ? speech(language) : deviceSpeech();
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
    const onItsBack = this.hasAttribute('data-done') && !this.hasAttribute('data-peek');
    const covered = this.hasAttribute('data-reveal') || this.hasAttribute('data-closing') || onItsBack;
    this.$('.tome-inner').inert = covered;
    // Lying on its back, the book shows its bookmark at the other edge — once it has finished
    // turning over (while it turns, the bookmark has slipped out of sight).
    const bookmark = this.$('[data-bookmark]');
    if (onItsBack && !this.hasAttribute('data-closing')) bookmark.setAttribute('side', 'right');
    else bookmark.removeAttribute('side');
  }

  // — opening: closed → the open book, the two days before → today's page ——————————————

  /** A card not yet opened waits closed, its spread laid out beneath the cover. */
  #arrange({ today, history, profile }: ReadingSnapshot, words: Speech): void {
    const waiting = today.unveiledAt === undefined && today.status === 'pending';
    if (!waiting) {
      if (!this.#playing) this.removeAttribute('data-reveal');
      this.#closedDay = null;
      this.#laidOut = '';
      return;
    }
    const layout = `${today.day}|${words.locale}`;
    if (this.#laidOut === layout) return;
    this.#laidOut = layout;
    this.#closedDay = today.day;
    this.$('[data-cover-date]').textContent = words.longDate(today.day);
    // The spread the camera pulls back to: the two days before today — or, in a brand-new
    // book, its front matter.
    const byDay = new Map(history.map((c) => [c.day, c]));
    const before = addDays(today.day, -2);
    const yesterday = addDays(today.day, -1);
    const fresh = !history.some((c) => c.day < today.day);
    this.$('[data-cover-back]').replaceChildren(
      fresh ? frontMatter('ex-libris', profile?.displayName ?? null, words) : pastPage(before, byDay.get(before), words),
    );
    this.$('[data-leaf]').replaceChildren(
      fresh ? frontMatter('chapter-one', null, words) : pastPage(yesterday, byDay.get(yesterday), words),
    );
    if (!this.#playing) this.setAttribute('data-reveal', 'closed');
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
      await wait(3300); // stand on the spine, a breath, fall open from the middle, the leaves riffle
      await countUp(show, target, 1100); // …and the count runs up as the camera pushes in
      // Hand over to the page only once the camera has come to rest: never mid-move.
      await Promise.race([finished(this.$('.tome-camera')), wait(1500)]);
      this.setAttribute('data-reveal', 'landed');
      await wait(550);
    }
    this.removeAttribute('data-reveal');
    this.#playing = false;
    this.#closedDay = null;
    this.#laidOut = '';
    this.#syncInert();
    await this.#challenge?.unveil();
  }

  // — closing: today's page → the open book → turned over onto the back cover ——————————

  /** The day is logged: the camera pulls back, today's page turns, the book is turned over. */
  #closeBook(): void {
    this.removeAttribute('data-peek');
    this.#turn('first');
  }

  /**
   * Plays the closing: the first time (with the seal pressed and the note appearing), again
   * (closing it after a look inside), or rewound (reopening it onto today's page). The state
   * it ends in is already set; `then` runs once the book is at rest.
   */
  #turn(kind: 'first' | 'again' | 'reopen', then?: () => void): void {
    clearTimeout(this.#turning);
    const settle = () => {
      this.removeAttribute('data-closing');
      this.#syncInert();
      then?.();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return settle();
    this.$('[data-cover-back]').replaceChildren(verso()); // the left half, as the book closes
    this.removeAttribute('data-closing');
    void this.offsetWidth;
    this.setAttribute('data-closing', kind === 'first' ? '' : kind);
    this.#syncInert();
    // The first time, until the note has appeared on the back cover; after, the quicker turn.
    this.#turning = setTimeout(settle, kind === 'first' ? 4650 : 3050);
  }

  /** The book in hand's own bookmark, lying in the book with the page on it, sticking out at the top. */
  #renderBookmark(book: BookInHand | null, t: Messages): void {
    const bookmark = this.$('[data-bookmark]');
    const page = book?.bookmark;
    const shown = book !== null && page !== undefined;
    bookmark.hidden = !shown;
    this.toggleAttribute('data-bookmarked', shown);
    if (!shown) return;
    // Each book keeps its own bookmark: the same woods every day until it is finished.
    bookmark.setAttribute('seed', String(hashOf(`${book.title}|${book.startedOn}`)));
    bookmark.setAttribute('mark', t.card.bookmarkTag(page));
    bookmark.setAttribute('aria-label', t.card.bookmarkLabel(book.title, page));
  }

  #render(snapshot: ReadingSnapshot): void {
    const { today, stats, shelf, achievements, readTo, language } = snapshot;
    const words = this.speak(language);
    const { t } = words;
    this.#arrange(snapshot, words);
    const done = today.status === 'completed';
    this.toggleAttribute('data-done', done);
    const plate = this.$('.tome-inner hmpt-ds-scene');
    plate.setAttribute('lang', words.language);
    plate.setAttribute('seed', String(today.artSeed));
    // The plate's caption, as in an illustrated book: the scene's own description.
    this.$('[data-caption]').textContent = plate.getAttribute('aria-label') ?? '';
    this.$('[data-date]').textContent = words.longDate(today.day);
    if (!this.#playing) {
      this.$('[data-pages]').textContent = String(today.pages);
      this.$('[data-folio]').textContent = `— ${today.pages} —`;
    }
    this.$('[data-unit]').textContent = t.card.unit(today.pages);
    this.$('[data-hint]').textContent = done
      ? t.card.hintDone(stats.currentStreak)
      : (t.card.hints[today.artSeed % t.card.hints.length] ?? '');

    // The bookmark: the page today's reading leads to, and — once read — where it now sits.
    const book = shelf.current;
    this.#renderBookmark(book, t);
    const total = book?.totalPages ?? null;
    this.$('[data-until]').hidden = readTo === null;
    if (readTo !== null) {
      this.$('[data-until-text]').textContent = readTo === total ? t.card.toTheEnd(readTo) : t.card.upTo(readTo);
    }
    this.$('[data-place]').hidden = done || !book || book.bookmark !== undefined;
    const marked = book?.bookmark !== undefined && book.bookmark > 0;
    const bookmarkText = marked ? t.card.bookmarkAt(book.bookmark!, total) : '';
    this.$('[data-bookmark-line]').hidden = !done || !marked;
    this.$('[data-bookmark-text]').textContent = bookmarkText;
    this.$('[data-back-bookmark]').hidden = !done || !marked;
    this.$('[data-back-bookmark-text]').textContent = bookmarkText;
    const atTheEnd = done && book !== null && marked && total !== null && book.bookmark! >= total;
    this.$('[data-last-page]').hidden = !atTheEnd;
    if (atTheEnd) this.$('[data-last-page-text]').textContent = t.card.lastPage(book.title);

    this.$('[data-pending]').hidden = done;
    this.$('[data-sealed]').hidden = !done;
    const justSealed = done && this.#seen?.day === today.day && this.#seen.done === false;
    this.#seen = { day: today.day, done };
    if (done) {
      const summary = readingSummary(today, t);
      this.$('[data-read]').textContent = summary;
      this.$('[data-read-page]').textContent = summary;
      this.$('[data-message]').textContent = backCoverNote(today, shelf.finished.at(-1)?.title ?? null, t);
      this.$('[data-extra]').textContent = backCoverExtra(stats.currentStreak, achievements, today.day, t);
      if (justSealed) this.#closeBook();
      this.#syncInert();
      return;
    }
    this.removeAttribute('data-peek');
    this.#syncInert();
    this.$('[data-complete]').textContent = t.card.readThem(today.pages);
    const log = this.$<HTMLFormElement>('[data-log-form]');
    const pagesInput = log.elements.namedItem('pagesRead') as HTMLInputElement;
    if (!pagesInput.value) pagesInput.value = String(today.pages);
    const titleInput = log.elements.namedItem('bookTitle') as HTMLInputElement;
    titleInput.placeholder = book ? book.title : t.common.title;
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves once the element's running animations have finished. */
const finished = (element: Element) =>
  Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined))).then(() => undefined);

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
function pastPage(day: string, card: DailyChallenge | undefined, words: Speech): HTMLElement {
  const { t } = words;
  const page = el('div', 'past-page');
  page.append(el('p', 'past-head', words.longDate(day)));
  const plate = el('div', 'past-plate');
  const frame = document.createElement('frame-pk');
  frame.setAttribute('ratio', '4:3');
  const scene = document.createElement('hmpt-ds-scene');
  scene.setAttribute('lang', words.language);
  scene.setAttribute('seed', String(card?.artSeed ?? hashOf(day)));
  frame.append(scene);
  plate.append(frame);
  page.append(plate);
  if (card?.status === 'completed') {
    const read = card.pagesRead ?? card.pages;
    page.append(el('p', 'past-number', String(read)), el('p', 'past-note', t.card.past.read(read)));
  } else if (card) {
    page.append(el('p', 'past-number past-faint', String(card.pages)), el('p', 'past-note', t.card.past.unread));
  } else {
    page.append(el('p', 'past-number past-faint', '—'), el('p', 'past-note', t.card.past.noCard));
  }
  return page;
}

/** The front matter of a brand-new book. */
function frontMatter(kind: 'ex-libris' | 'chapter-one', name: string | null, { t }: Speech): HTMLElement {
  const page = el('div', `past-page past-${kind}`);
  if (kind === 'ex-libris') {
    const plate = el('div', 'past-bookplate');
    plate.append(el('p', 'past-bookplate-title', t.card.past.exLibris), el('p', 'past-bookplate-name', name ?? t.card.past.newReader));
    page.append(plate);
  } else {
    page.append(
      el('p', 'past-chapter-eyebrow', t.card.past.chapter),
      el('p', 'past-chapter-title', t.card.past.one),
      el('p', 'past-ornament', '❦'),
    );
  }
  return page;
}

/** The back of a turned leaf: paper ruled with lines of text. */
const verso = (): HTMLElement => el('div', 'past-page past-verso');
