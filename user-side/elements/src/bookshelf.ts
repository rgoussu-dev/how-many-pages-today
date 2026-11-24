import type {
  BookInHand,
  BookshelfPort,
  FieldError,
  FinishedBook,
  ReadingSnapshot,
  ReadingView,
} from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { showFieldErrors, typedNumber } from './forms';
import { deviceSpeech, speech, type Speech } from './i18n';
import { PortBoundElement } from './port-bound';

/** Leather bindings for the spines; a title always gets the same one. */
const BINDINGS = ['#6b2618', '#2f4a32', '#27324f', '#8a5a1e', '#4a2a17', '#4e2338', '#244a4a', '#7a3a24'];

const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * `<hmpt-bookshelf>` — the book on the nightstand and its bookmark, a way to shelve it once
 * finished, and the shelf of every finished book, spine out.
 */
export class Bookshelf extends PortBoundElement {
  #shelf?: BookshelfPort;
  #view?: ReadingView;
  /** The bookmark the form was last filled from — refilled only when it moves. */
  #filledFrom = '';

  protected markup(): string {
    return /* html */ `
      <section class="surface" aria-labelledby="shelf-title">
        <box-pk padding="var(--s1)">
          <stack-pk space="var(--s0)">
            <div class="shelf-head">
              <h2 id="shelf-title" data-t="shelf.heading"></h2>
              <span class="chip" data-count></span>
            </div>
            <div class="nightstand" data-nightstand hidden>
              <p class="eyebrow" data-t="shelf.nightstand"></p>
              <p class="nightstand-title"><cite data-current></cite></p>
              <div class="nightstand-bookmark" data-bookmark>
                <p class="nightstand-page"><span class="ribbon" aria-hidden="true"></span><span data-bookmark-text></span></p>
                <div class="meter" role="progressbar" data-t-label="shelf.progressLabel" aria-valuemin="0" aria-valuemax="100" data-progress hidden><span></span></div>
                <p class="nightstand-end" data-last-page hidden data-t="shelf.lastPage"></p>
              </div>
              <details class="nightstand-move" data-move>
                <summary data-move-summary></summary>
                <form novalidate class="shelf-start book-pages" data-move-form>
                  <label class="field"><span data-t="shelf.onPage"></span>
                    <input name="bookmark" type="number" inputmode="numeric" min="0" max="20000" step="1">
                  </label>
                  <label class="field"><span><span data-t="shelf.totalPages"></span> <em data-t="common.optional"></em></span>
                    <input name="totalPages" type="number" inputmode="numeric" min="1" max="20000" step="1">
                  </label>
                  <p class="field-error" data-error="bookmark"></p>
                  <p class="field-error" data-error="totalPages"></p>
                  <cluster-pk space="var(--s0)" align="center">
                    <button class="btn" type="submit" data-t="common.save"></button>
                    <p class="status" role="status" data-move-status></p>
                  </cluster-pk>
                </form>
              </details>
              <button type="button" class="btn btn-primary" data-finish data-t="shelf.finishedIt"></button>
            </div>
            <details data-finish-wrap hidden>
              <summary data-t="shelf.finishedABook"></summary>
              <form novalidate class="shelf-start" data-finish-form>
                <label class="field"><span><span data-t="shelf.whichOne"></span> <em data-t="common.optional"></em></span>
                  <input name="finishedTitle" maxlength="120" autocomplete="off" data-t-placeholder="common.title">
                </label>
                <p class="field-error" data-error="finishedTitle"></p>
                <button class="btn btn-primary" type="submit" data-t="shelf.putOnShelf"></button>
              </form>
            </details>
            <details data-start-wrap>
              <summary data-start-summary data-t="shelf.readingElse"></summary>
              <form novalidate class="shelf-start" data-start-form>
                <label class="field"><span data-start-label></span>
                  <input name="title" maxlength="120" autocomplete="off" data-t-placeholder="shelf.titlePlaceholder">
                </label>
                <p class="field-error" data-error="title"></p>
                <div class="book-pages">
                  <label class="field"><span><span data-t="shelf.onPage"></span> <em data-t="common.optional"></em></span>
                    <input name="bookmark" type="number" inputmode="numeric" min="0" max="20000" step="1" data-t-placeholder="shelf.fromTheStart">
                  </label>
                  <label class="field"><span><span data-t="shelf.totalPages"></span> <em data-t="common.optional"></em></span>
                    <input name="totalPages" type="number" inputmode="numeric" min="1" max="20000" step="1">
                  </label>
                </div>
                <p class="field-error" data-error="bookmark"></p>
                <p class="field-error" data-error="totalPages"></p>
                <button class="btn" type="submit" data-t="shelf.startReading"></button>
              </form>
            </details>
            <div class="shelf-wood">
              <reel-pk class="shelf" space="2px" noBar data-t-label="shelf.shelfLabel" data-shelf></reel-pk>
            </div>
            <p class="muted shelf-empty" data-empty data-t="shelf.empty"></p>
          </stack-pk>
        </box-pk>
      </section>`;
  }

  protected override setup(): void {
    const start = this.$<HTMLFormElement>('[data-start-form]');
    start.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#shelf) return;
      const field = (name: string) => start.elements.namedItem(name) as HTMLInputElement;
      const bookmark = typedNumber(field('bookmark'));
      const totalPages = typedNumber(field('totalPages'));
      const result = await this.#shelf.startReading({
        title: field('title').value,
        ...(bookmark === undefined ? {} : { bookmark }),
        ...(totalPages === undefined ? {} : { totalPages }),
      });
      showFieldErrors(start, result.ok ? [] : result.error, this.#words().t);
      if (result.ok) {
        start.reset();
        this.$<HTMLDetailsElement>('[data-start-wrap]').open = false;
      }
    });

    const move = this.$<HTMLFormElement>('[data-move-form]');
    move.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#shelf) return;
      const field = (name: string) => move.elements.namedItem(name) as HTMLInputElement;
      const bookmark = typedNumber(field('bookmark'));
      const result = await this.#shelf.updateBook({
        ...(bookmark === undefined ? {} : { bookmark }),
        totalPages: typedNumber(field('totalPages')) ?? null,
      });
      const { t } = this.#words();
      showFieldErrors(move, result.ok ? [] : result.error, t);
      const status = this.$('[data-move-status]');
      status.dataset.tone = result.ok ? 'ok' : 'warn';
      status.textContent = result.ok ? t.common.saved : '';
    });
    move.addEventListener('input', () => (this.$('[data-move-status]').textContent = ''));

    this.$('[data-finish]').addEventListener('click', () => void this.#shelf?.finishBook());
    const finish = this.$<HTMLFormElement>('[data-finish-form]');
    finish.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#shelf) return;
      const input = finish.elements.namedItem('finishedTitle') as HTMLInputElement;
      const result = await this.#shelf.finishBook({ title: input.value });
      const errors: FieldError[] = result.ok ? [] : result.error.map((e) => ({ ...e, field: 'finishedTitle' }));
      showFieldErrors(finish, errors, this.#words().t);
      if (result.ok) {
        input.value = '';
        this.$<HTMLDetailsElement>('[data-finish-wrap]').open = false;
      }
    });
  }

  protected connect() {
    this.#shelf = this.request(readingContexts.bookshelf);
    this.#view = this.request(readingContexts.view);
    return [this.#view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #words(): Speech {
    const language = this.#view?.current()?.language;
    return language ? speech(language) : deviceSpeech();
  }

  #render({ shelf, language }: ReadingSnapshot): void {
    const words = this.speak(language);
    const { t } = words;
    const book = shelf.current;
    this.$('[data-nightstand]').hidden = !book;
    this.$('[data-current]').textContent = book?.title ?? '';
    this.$('[data-finish-wrap]').hidden = book !== null;
    // With nothing in hand, starting a book is the point: open, no summary to click.
    const details = this.$<HTMLDetailsElement>('[data-start-wrap]');
    if (!book) details.open = true;
    this.$('[data-start-summary]').hidden = !book;
    this.$('[data-start-label]').textContent = book ? t.shelf.anotherInstead : t.shelf.whatReading;
    if (book) this.#renderBookmark(book, words);

    const count = shelf.finished.length;
    this.$('[data-count]').textContent = t.shelf.count(count);
    this.$('[data-empty]').hidden = count > 0;
    this.$('[data-shelf]').replaceChildren(...[...shelf.finished].reverse().map((b) => this.#spine(b, words)));
  }

  /** Where the bookmark sits, how far that is into the book, and a way to move it. */
  #renderBookmark(book: BookInHand, { t }: Speech): void {
    const marked = book.bookmark !== undefined;
    const total = book.totalPages ?? null;
    this.$('[data-bookmark-text]').textContent = marked ? t.shelf.bookmark(book.bookmark!, total) : t.shelf.noBookmark;
    const progress = this.$('[data-progress]');
    progress.hidden = !marked || total === null;
    if (marked && total !== null) {
      const percent = Math.min(100, Math.round((book.bookmark! / total) * 100));
      progress.style.setProperty('--meter-value', `${percent}%`);
      progress.setAttribute('aria-valuenow', String(percent));
      progress.setAttribute('aria-valuetext', t.shelf.percent(percent));
    }
    const atTheEnd = marked && total !== null && book.bookmark! >= total;
    this.$('[data-last-page]').hidden = !atTheEnd;
    this.toggleAttribute('data-at-the-end', atTheEnd);
    this.$('[data-move-summary]').textContent = marked ? t.shelf.moveBookmark : t.shelf.placeBookmark;

    // Refill the form when the book or its bookmark moved — never while the reader types in it.
    const form = this.$<HTMLFormElement>('[data-move-form]');
    const key = `${book.title}|${book.startedOn}|${book.bookmark}|${total}`;
    if (this.#filledFrom !== key && !form.contains(document.activeElement)) {
      (form.elements.namedItem('bookmark') as HTMLInputElement).value = marked ? String(book.bookmark) : '';
      (form.elements.namedItem('totalPages') as HTMLInputElement).value = total === null ? '' : String(total);
      this.#filledFrom = key;
    }
  }

  #spine(book: FinishedBook, words: Speech): HTMLElement {
    const { t } = words;
    const name = book.title ?? t.common.aBook;
    const date = words.shortDate(book.finishedOn);
    const h = hash(book.title ?? `${book.finishedOn}#untitled`);
    const spine = document.createElement('span');
    spine.className = 'spine';
    spine.setAttribute('role', 'img');
    spine.setAttribute('aria-label', t.shelf.spine(name, date));
    spine.title = t.shelf.spineTitle(name, date);
    spine.toggleAttribute('data-untitled', book.title === null);
    spine.style.setProperty('--binding', BINDINGS[h % BINDINGS.length] ?? BINDINGS[0]!);
    spine.style.setProperty('--spine-height', `${(7.2 + ((h >>> 8) % 25) / 10).toFixed(1)}rem`);
    spine.style.setProperty('--spine-width', `${(2 + ((h >>> 16) % 7) / 10).toFixed(1)}rem`);
    const title = document.createElement('span');
    title.className = 'spine-title';
    title.textContent = book.title ?? '❦';
    spine.append(title);
    return spine;
  }
}
