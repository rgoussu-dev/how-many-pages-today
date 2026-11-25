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
import { showFieldErrors, typedNumber } from './forms';
import { deviceSpeech, speech, type Messages, type Speech } from './i18n';
import { PortBoundElement } from './port-bound';
import { ScrollScene, type Wax } from './scroll-scene';

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

/** The wax the day is sealed in: short of the goal, the goal, beyond it, or a book finished. */
function waxOf(day: DailyChallenge): Wax {
  const read = day.pagesRead ?? day.pages;
  return day.finishedBook ? 'book' : read > day.pages ? 'beyond' : day.goalMet === false ? 'short' : 'met';
}

/** A warm note from the librarian — chosen by chance, but the same all day. */
function backCoverNote(day: DailyChallenge, bookTitle: string | null, t: Messages): string {
  const kind = waxOf(day);
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
 * of them turns over, and lands on today's page. There the reader writes the page they
 * stopped at (with no bookmark yet, the page first asks for the book and where it is marked).
 * Logged, the camera pulls back again, today's page turns, the book is turned over onto its
 * back cover, and a scroll is written, sealed in the day's wax and left open on it.
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
  /** The last day, status and pages rendered, to tell a fresh validation (or reading on) from a reload. */
  #seen: { day: string; done: boolean; read: number } | null = null;
  /** What the page field was last filled in for, so a re-render never overwrites the reader's typing. */
  #filledFor = '';
  #scroll!: ScrollScene;
  /** A tap asked to skip the ceremony before it began (while the book was still turning over). */
  #skipCeremony = false;

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
          <p class="tome-read" data-read-page hidden></p>

          <!-- No bookmark yet: the book on the nightstand, and the page it is marked at. -->
          <div class="tome-actions" data-book-needed hidden>
            <p class="tome-ask" data-book-ask></p>
            <form novalidate data-book-form class="tome-book-form">
              <label class="field" data-book-title><span data-t="card.book.title"></span>
                <input name="title" maxlength="120" autocomplete="off" required>
              </label>
              <p class="field-error" data-error="title"></p>
              <div class="tome-book-pages">
                <label class="field"><span data-t="card.book.bookmark"></span>
                  <input name="bookmark" type="number" inputmode="numeric" min="0" step="1" value="0">
                </label>
                <label class="field"><span><span data-t="card.book.total"></span> <em data-t="common.optional"></em></span>
                  <input name="totalPages" type="number" inputmode="numeric" min="1" step="1">
                </label>
              </div>
              <p class="field-error" data-error="bookmark"></p>
              <p class="field-error" data-error="totalPages"></p>
              <button class="btn btn-primary" type="submit" data-t="card.book.put"></button>
            </form>
          </div>

          <!-- The page the reading stopped at: the day's, or, once sealed, reading on. -->
          <div class="tome-actions" data-log hidden>
            <form novalidate data-log-form class="tome-log-form">
              <label class="tome-stop">
                <span class="tome-stop-label" data-log-label></span>
                <input class="tome-stop-page" name="stoppedAt" type="number" inputmode="numeric" step="1" required>
              </label>
              <label class="tome-check" data-last-field hidden><input type="checkbox" name="finishedBook"> <span data-t="card.lastPageCheck"></span></label>
              <p class="field-error" data-error="log" role="alert"></p>
              <button class="btn btn-primary btn-block" type="submit" data-t="card.seal"></button>
            </form>
          </div>

          <button type="button" class="btn btn-quiet" data-close-book hidden data-t="card.closeBook"></button>
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
            <!-- The scroll: written by the librarian, sealed in the day's wax. -->
            <div class="scroll" data-scroll data-state="open">
              <div class="scroll-body">
                <i class="scroll-rod scroll-rod-top" aria-hidden="true"></i>
                <div class="scroll-sheet" data-sheet>
                  <div class="scroll-writing" role="status">
                    <p class="scroll-date" data-line data-scroll-date></p>
                    <p class="scroll-head" data-line data-head></p>
                    <p class="scroll-line" data-line data-read></p>
                    <p class="scroll-line" data-line data-message></p>
                    <p class="scroll-line" data-line data-back-bookmark hidden></p>
                    <p class="scroll-line" data-line data-extra hidden></p>
                    <p class="scroll-sign" data-line data-sign data-t="card.scroll.signature"></p>
                    <span class="scroll-quill" data-quill aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M14 50C22 30 38 12 61 3 53 22 37 40 14 50Z" fill="#fbf4e2" stroke="#6b4a26" stroke-width="1.5"/><path d="M5 59 52 12" stroke="#6b4a26" stroke-width="2" stroke-linecap="round"/><path d="M3 61 8 56" stroke="#1c1209" stroke-width="2.5" stroke-linecap="round"/></svg></span>
                  </div>
                  <button type="button" class="scroll-read-on" data-read-on data-t="card.scroll.readOn"></button>
                </div>
                <i class="scroll-rod scroll-rod-bottom" aria-hidden="true"></i>
                <span class="scroll-roll" aria-hidden="true"><i class="scroll-band"></i></span>
              </div>
              <div class="scroll-spot" data-spot>
                <span class="scroll-tails" aria-hidden="true"><i></i><i></i></span>
                <span class="wax-rays" aria-hidden="true"></span>
                <span class="wax-ripple" aria-hidden="true"></span><span class="wax-ripple" aria-hidden="true"></span>
                <span class="wax-puddle" data-puddle aria-hidden="true">
                  <span class="wax-seal">
                    <span class="wax-face">
                      <svg class="wax-mark wax-mark-short" viewBox="0 0 48 48"><path d="M24 5c3 6 9 10 9 18a9 9 0 0 1-18 0c0-5 3-8 5-11 1 3 2 4 4 5-1-4 0-8 0-12zM18 38h12M20 43h8"/></svg>
                      <svg class="wax-mark wax-mark-met" viewBox="0 0 64 44"><path d="M32 8C26 4 18 3 6 4v32c12-1 20 0 26 4 6-4 14-5 26-4V4C46 3 38 4 32 8zM32 8v32"/></svg>
                      <svg class="wax-mark wax-mark-beyond" viewBox="0 0 48 48"><polygon points="24,4 29.6,17.6 44,18.6 33,28 36.4,42.4 24,34.6 11.6,42.4 15,28 4,18.6 18.4,17.6"/></svg>
                      <svg class="wax-mark wax-mark-book" viewBox="0 0 48 48"><text x="24" y="29" text-anchor="middle" data-finis></text></svg>
                    </span>
                    <span class="wax-sheen"></span>
                  </span>
                </span>
                <span class="wax-stamp" aria-hidden="true"><i></i><i></i><i></i></span>
                <span class="wax-leaves" data-leaves aria-hidden="true"></span>
                <button type="button" class="scroll-seal" data-seal></button>
              </div>
              <span class="wax-drip" aria-hidden="true"></span>
              <span class="candle" aria-hidden="true"><span class="candle-tilt"><i class="candle-flame"></i><i class="candle-wick"></i><i class="candle-body"></i></span></span>
            </div>
            <p class="scroll-hint" data-scroll-hint></p>
          </div>
        </div>
      </article>
      </div>`;
  }

  protected override setup(): void {
    this.#scroll = new ScrollScene(this.$('[data-scroll]'));
    this.addEventListener('scroll-state', () => this.#syncScroll());
    const cover = this.$('[data-open-cover]');
    cover.addEventListener('click', () => void this.#open());
    cover.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void this.#open();
      }
    });

    // The back cover: a tap skips the ceremony; on the open scroll it rolls it up; the seal
    // rolls and unrolls it; "I read some more" reopens the book onto today's page.
    this.$('.tome-back-face').addEventListener('click', (event) => {
      const state = this.#scroll.state;
      if (state === 'playing' || this.hasAttribute('data-closing')) {
        if (this.hasAttribute('data-done')) this.#skip();
        return;
      }
      if (state === 'open' && !(event.target as Element).closest('button')) void this.#scroll.toggle();
    });
    this.$('[data-seal]').addEventListener('click', (event) => {
      event.stopPropagation();
      void this.#scroll.toggle();
    });
    // Reopening after the day is read: the closing, rewound; closing it again: the closing,
    // replayed. Both a little quicker than the first time.
    this.$('[data-read-on]').addEventListener('click', (event) => {
      event.stopPropagation();
      this.setAttribute('data-peek', '');
      this.#turn('reopen', () => this.$<HTMLInputElement>('[name="stoppedAt"]').focus());
    });
    this.$('[data-close-book]').addEventListener('click', () => {
      this.removeAttribute('data-peek');
      this.#turn('again', () => this.$<HTMLElement>('[data-seal]').focus());
    });

    const log = this.$<HTMLFormElement>('[data-log-form]');
    const stopped = log.elements.namedItem('stoppedAt') as HTMLInputElement;
    const last = log.elements.namedItem('finishedBook') as HTMLInputElement;
    log.addEventListener('submit', async (event) => {
      event.preventDefault();
      const entry = {
        stoppedAt: stopped.valueAsNumber,
        ...(last.checked && !this.$('[data-last-field]').hidden ? { finishedBook: true } : {}),
      };
      const readingOn = this.hasAttribute('data-done');
      const error = await this.#run((port) => (readingOn ? port.readOn(entry) : port.complete(entry)));
      const book = this.#view?.current()?.shelf.current;
      this.$('[data-error="log"]').textContent = error
        ? this.#words().t.card.errors(error, book?.bookmark ?? 0, book?.totalPages ?? null)
        : '';
      stopped.toggleAttribute('aria-invalid', error !== null);
      if (!error) last.checked = false;
    });

    const bookForm = this.$<HTMLFormElement>('[data-book-form]');
    bookForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#shelf) return;
      const field = (name: string) => bookForm.elements.namedItem(name) as HTMLInputElement;
      const bookmark = typedNumber(field('bookmark')) ?? 0;
      const totalPages = typedNumber(field('totalPages'));
      const pages = { bookmark, ...(totalPages === undefined ? {} : { totalPages }) };
      const inHand = this.#view?.current()?.shelf.current;
      const result = inHand
        ? await this.#shelf.updateBook(pages)
        : await this.#shelf.startReading({ title: field('title').value, ...pages });
      showFieldErrors(bookForm, result.ok ? [] : result.error, this.#words().t);
      if (result.ok) stopped.focus();
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

  /** The words around the scroll follow its state: how to skip, roll or unroll it. */
  #syncScroll(): void {
    const { t } = this.#words();
    const state = this.#scroll.state;
    const playing = state === 'playing';
    this.$('[data-scroll-hint]').textContent = playing ? t.card.scroll.skip : state === 'open' ? t.card.scroll.openHint : t.card.scroll.rolledHint;
    this.$('[data-seal]').setAttribute('aria-label', state === 'open' ? t.card.scroll.rollUp : t.card.scroll.unroll);
    this.$('[data-seal]').hidden = playing;
    this.$('[data-read-on]').inert = state !== 'open';
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

  /**
   * The day is logged (or logged again, reading on): the book closes and turns over, and
   * the scroll is written and sealed on its back cover.
   */
  #seal(wax: Wax, kind: 'first' | 'again'): void {
    this.removeAttribute('data-peek');
    this.#skipCeremony = false;
    this.#scroll.hold();
    this.#turn(kind, () => {
      if (this.#skipCeremony) this.#scroll.settle('open');
      else void this.#scroll.play(wax);
    });
  }

  /** Skips straight to the sealed scroll, lying open. */
  #skip(): void {
    this.#skipCeremony = true;
    if (!this.hasAttribute('data-closing')) this.#scroll.settle('open');
  }

  /**
   * Plays the closing: the first time, again (closing it after a look inside), or rewound
   * (reopening it onto today's page). The state it ends in is already set; `then` runs once
   * the book is at rest.
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
    this.#turning = setTimeout(settle, kind === 'first' ? 4450 : 3050);
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

  /** The page's fields: the book and its bookmark first if there is none, then the page reached. */
  #renderFields(snapshot: ReadingSnapshot, done: boolean, t: Messages): void {
    const book = snapshot.shelf.current;
    const marked = book !== null && book.bookmark !== undefined;
    this.$('[data-book-needed]').hidden = marked;
    this.$('[data-log]').hidden = !marked;
    this.$('[data-book-title]').hidden = book !== null;
    this.$('[data-book-ask]').textContent = book ? t.card.book.askBookmark(book.title) : t.card.book.ask;
    this.$<HTMLInputElement>('[data-book-form] [name="title"]').placeholder = t.shelf.titlePlaceholder;
    if (!marked) return;

    const log = this.$<HTMLFormElement>('[data-log-form]');
    const stopped = log.elements.namedItem('stoppedAt') as HTMLInputElement;
    this.$('[data-log-label]').textContent = done ? t.card.readOnTo : t.card.stoppedAt;
    stopped.min = String(book.bookmark! + 1);
    if (book.totalPages !== undefined) stopped.max = String(book.totalPages);
    else stopped.removeAttribute('max');
    this.$('[data-last-field]').hidden = book.totalPages !== undefined;
    // Filled in once for each day, state and bookmark: the page the card asked to reach, or —
    // reading on — left for the reader to write. Never while they are typing.
    const filledFor = `${snapshot.today.day}|${done}|${book.title}|${book.bookmark}`;
    if (this.#filledFor !== filledFor) {
      this.#filledFor = filledFor;
      stopped.value = done || snapshot.readTo === null ? '' : String(snapshot.readTo);
      this.$('[data-error="log"]').textContent = '';
    }
  }

  /** The scroll's words: the day, how it went, a note from the librarian, the bookmark, the streak. */
  #renderScroll(snapshot: ReadingSnapshot, words: Speech): void {
    const { today, stats, shelf, achievements } = snapshot;
    const { t } = words;
    const wax = waxOf(today);
    this.setAttribute('data-wax', wax);
    const write = (selector: string, text: string) => {
      const line = this.$(selector);
      line.hidden = text === '';
      if (line.textContent !== text) line.textContent = text;
    };
    write('[data-scroll-date]', words.longDate(today.day));
    write('[data-head]', t.card.scroll.heads[wax]);
    write('[data-read]', readingSummary(today, t));
    write('[data-message]', backCoverNote(today, shelf.finished.at(-1)?.title ?? null, t));
    const book = shelf.current;
    write('[data-back-bookmark]', book?.bookmark ? t.card.bookmarkAt(book.bookmark, book.totalPages ?? null) : '');
    write('[data-extra]', backCoverExtra(stats.currentStreak, achievements, today.day, t));
    this.$('[data-finis]').textContent = t.card.scroll.finis;
    this.#syncScroll();
  }

  #render(snapshot: ReadingSnapshot): void {
    const { today, stats, shelf, readTo, language } = snapshot;
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
    const marked = book?.bookmark !== undefined && book.bookmark > 0;
    const until = done ? (marked ? t.card.bookmarkAt(book.bookmark!, total) : '') : readTo === null ? '' : readTo === total ? t.card.toTheEnd(readTo) : t.card.upTo(readTo);
    this.$('[data-until]').hidden = until === '';
    this.$('[data-until-text]').textContent = until;
    this.#renderFields(snapshot, done, t);

    this.$('[data-read-page]').hidden = !done;
    this.$('[data-close-book]').hidden = !done;
    const read = today.pagesRead ?? today.pages;
    const seen = this.#seen;
    this.#seen = { day: today.day, done, read };
    if (!done) {
      this.removeAttribute('data-peek');
      this.#syncInert();
      return;
    }
    this.$('[data-read-page]').textContent = readingSummary(today, t);
    this.#renderScroll(snapshot, words);
    const sameDay = seen?.day === today.day;
    if (sameDay && !seen.done) this.#seal(waxOf(today), 'first');
    else if (sameDay && seen.read !== read) this.#seal(waxOf(today), 'again');
    this.#syncInert();
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
