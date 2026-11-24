import type { BookshelfPort, FinishedBook, ReadingSnapshot } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { shortDate } from './format';
import { showFieldErrors } from './forms';
import { PortBoundElement } from './port-bound';

/** Leather bindings for the spines; a title always gets the same one. */
const BINDINGS = ['#6b2618', '#2f4a32', '#27324f', '#8a5a1e', '#4a2a17', '#4e2338', '#244a4a', '#7a3a24'];

const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * `<hmpt-bookshelf>` — the book on the nightstand, a way to shelve it once finished, and
 * the shelf of every finished book, spine out.
 */
export class Bookshelf extends PortBoundElement {
  #shelf?: BookshelfPort;

  protected markup(): string {
    return /* html */ `
      <section class="surface" aria-labelledby="shelf-title">
        <box-pk padding="var(--s1)">
          <stack-pk space="var(--s0)">
            <div class="shelf-head">
              <h2 id="shelf-title">Your shelf</h2>
              <span class="chip" data-count>0 books</span>
            </div>
            <div class="nightstand" data-nightstand hidden>
              <p class="eyebrow">On the nightstand</p>
              <p class="nightstand-title"><cite data-current></cite></p>
              <button type="button" class="btn btn-primary" data-finish>I finished it</button>
            </div>
            <details data-finish-wrap hidden>
              <summary>Finished a book?</summary>
              <form novalidate class="shelf-start" data-finish-form>
                <label class="field"><span>Which one? <em>(optional)</em></span>
                  <input name="finishedTitle" maxlength="120" autocomplete="off" placeholder="Title">
                </label>
                <p class="field-error" data-error="finishedTitle"></p>
                <button class="btn btn-primary" type="submit">Put it on the shelf</button>
              </form>
            </details>
            <details data-start-wrap>
              <summary data-start-summary>Reading something else?</summary>
              <form novalidate class="shelf-start">
                <label class="field"><span data-start-label>What are you reading?</span>
                  <input name="title" maxlength="120" autocomplete="off" placeholder="Title of the book">
                </label>
                <p class="field-error" data-error="title"></p>
                <button class="btn" type="submit">Start reading</button>
              </form>
            </details>
            <div class="shelf-wood">
              <reel-pk class="shelf" space="2px" noBar aria-label="Books you have finished" data-shelf></reel-pk>
            </div>
            <p class="muted shelf-empty" data-empty>Your shelf awaits its first book.</p>
          </stack-pk>
        </box-pk>
      </section>`;
  }

  protected override setup(): void {
    const form = this.$<HTMLFormElement>('[data-start-wrap] form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#shelf) return;
      const input = form.elements.namedItem('title') as HTMLInputElement;
      const result = await this.#shelf.startReading(input.value);
      showFieldErrors(this, result.ok ? [] : result.error);
      if (result.ok) {
        input.value = '';
        this.$<HTMLDetailsElement>('[data-start-wrap]').open = false;
      }
    });
    this.$('[data-finish]').addEventListener('click', () => void this.#shelf?.finishBook());
    const finish = this.$<HTMLFormElement>('[data-finish-form]');
    finish.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#shelf) return;
      const input = finish.elements.namedItem('finishedTitle') as HTMLInputElement;
      const result = await this.#shelf.finishBook({ title: input.value });
      const errors = result.ok ? [] : result.error.map((e) => ({ ...e, field: 'finishedTitle' }));
      showFieldErrors(this, errors);
      if (result.ok) {
        input.value = '';
        this.$<HTMLDetailsElement>('[data-finish-wrap]').open = false;
      }
    });
  }

  protected connect() {
    this.#shelf = this.request(readingContexts.bookshelf);
    const view = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #render({ shelf }: ReadingSnapshot): void {
    const reading = shelf.current !== null;
    this.$('[data-nightstand]').hidden = !reading;
    this.$('[data-current]').textContent = shelf.current?.title ?? '';
    this.$('[data-finish-wrap]').hidden = reading;
    // With nothing in hand, starting a book is the point: open, no summary to click.
    const details = this.$<HTMLDetailsElement>('[data-start-wrap]');
    if (!reading) details.open = true;
    this.$('[data-start-summary]').hidden = !reading;
    this.$('[data-start-label]').textContent = reading ? 'Starting another book instead?' : 'What are you reading?';

    const count = shelf.finished.length;
    this.$('[data-count]').textContent = `${count} ${count === 1 ? 'book' : 'books'}`;
    this.$('[data-empty]').hidden = count > 0;
    this.$('[data-shelf]').replaceChildren(...[...shelf.finished].reverse().map((book) => this.#spine(book)));
  }

  #spine(book: FinishedBook): HTMLElement {
    const name = book.title ?? 'A book';
    const h = hash(book.title ?? `${book.finishedOn}#untitled`);
    const spine = document.createElement('span');
    spine.className = 'spine';
    spine.setAttribute('role', 'img');
    spine.setAttribute('aria-label', `${name}, finished ${shortDate(book.finishedOn)}`);
    spine.title = `${name} — finished ${shortDate(book.finishedOn)}`;
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
