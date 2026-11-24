import type { ReadingEvent } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { deviceSpeech, speech, type Messages } from './i18n';
import { PortBoundElement } from './port-bound';

const CONFETTI = ['🍂', '🍁', '✨', '📖', '🍂', '🔖'];
const TOAST_MS = 4200;

/**
 * `<hmpt-celebration>` — listens to domain events and makes a small fuss: a flurry of
 * autumn leaves for a completed card or a finished book, a toast for each achievement.
 */
export class Celebration extends PortBoundElement {
  #queue: string[] = [];
  #showing = false;

  protected markup(): string {
    return /* html */ `
      <div class="burst" data-burst aria-hidden="true"></div>
      <div class="toast" role="status" aria-live="polite" data-toast></div>`;
  }

  protected connect() {
    const view = this.request(readingContexts.view);
    return [
      view.onEvent((event) => {
        const language = view.current()?.language;
        this.#on(event, (language ? speech(language) : deviceSpeech()).t);
      }),
    ];
  }

  #on(event: ReadingEvent, t: Messages): void {
    const say = t.celebration;
    switch (event.type) {
      case 'challenge-completed': {
        const { pages, pagesRead = pages, goalMet } = event.challenge;
        this.#burst();
        this.#toast(
          pagesRead > pages
            ? say.beyond(pagesRead - pages)
            : goalMet === false
              ? say.short(pagesRead)
              : event.streak > 1
                ? say.streak(event.streak)
                : say.read(pagesRead),
        );
        break;
      }
      case 'pages-added':
        this.#toast(say.added(event.added, event.challenge.pagesRead ?? event.challenge.pages));
        break;
      case 'book-finished':
        this.#burst();
        this.#toast(
          event.book.title ? say.shelved(event.book.title, event.booksRead) : say.shelvedUntitled(event.booksRead),
        );
        break;
      case 'achievement-unlocked':
        this.#toast(say.achievement(event.achievement.icon, t.achievements.list[event.achievement.id].title));
        break;
    }
  }

  #burst(): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const burst = this.$('[data-burst]');
    const pieces = Array.from({ length: 18 }, (_, i) => {
      const piece = document.createElement('span');
      piece.textContent = CONFETTI[i % CONFETTI.length] ?? '✨';
      const angle = (i / 18) * Math.PI * 2;
      const distance = 90 + Math.random() * 90;
      piece.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
      piece.style.setProperty('--dy', `${Math.sin(angle) * distance * 0.6 + 70}px`);
      piece.style.setProperty('--spin', `${Math.random() * 540 - 270}deg`);
      return piece;
    });
    burst.replaceChildren(...pieces);
    setTimeout(() => burst.replaceChildren(), 1400);
  }

  #toast(message: string): void {
    this.#queue.push(message);
    if (!this.#showing) this.#next();
  }

  #next(): void {
    const message = this.#queue.shift();
    const toast = this.$('[data-toast]');
    if (message === undefined) {
      this.#showing = false;
      toast.removeAttribute('data-visible');
      return;
    }
    this.#showing = true;
    toast.textContent = message;
    toast.setAttribute('data-visible', '');
    setTimeout(() => this.#next(), TOAST_MS);
  }
}
