import type { ReadingSnapshot } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { PortBoundElement } from './port-bound';

/** `<hmpt-greeting>` — says hello, or invites a first-time reader to introduce themselves. */
export class Greeting extends PortBoundElement {
  protected markup(): string {
    return /* html */ `
      <header class="greeting">
        <span class="greeting-avatar" data-avatar aria-hidden="true">📚</span>
        <div>
          <h1 data-hello></h1>
          <p class="muted" data-sub></p>
        </div>
      </header>`;
  }

  protected connect() {
    const view = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #render({ profile, shelf, language }: ReadingSnapshot): void {
    const { t } = this.speak(language);
    const hello = t.greeting.salutation(new Date().getHours());
    this.$('[data-avatar]').textContent = profile?.avatar ?? '📚';
    this.$('[data-hello]').textContent = profile ? t.greeting.named(hello, profile.displayName) : t.greeting.anonymous(hello);
    const sub = this.$('[data-sub]');
    if (shelf.current) {
      const title = document.createElement('cite');
      title.textContent = shelf.current.title;
      sub.replaceChildren(t.greeting.nightstand, title, t.greeting.nightstandEnd(shelf.current.bookmark ?? null));
    } else if (!profile) {
      const link = document.createElement('a');
      link.href = '#profile';
      link.textContent = t.greeting.fillCard;
      sub.replaceChildren(t.greeting.newHere, link, '.');
    } else {
      sub.textContent = t.greeting.laidOut;
    }
  }
}
