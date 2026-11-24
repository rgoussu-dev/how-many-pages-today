import type { ReadingSnapshot } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { PortBoundElement } from './port-bound';

const salutation = (hour: number): string =>
  hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

/** `<hmpt-greeting>` — says hello, or invites a first-time reader to introduce themselves. */
export class Greeting extends PortBoundElement {
  protected markup(): string {
    return /* html */ `
      <header class="greeting">
        <span class="greeting-avatar" data-avatar aria-hidden="true">📚</span>
        <div>
          <h1 data-hello>Hello</h1>
          <p class="muted" data-sub></p>
        </div>
      </header>`;
  }

  protected connect() {
    const view = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #render({ profile, shelf }: ReadingSnapshot): void {
    const hello = salutation(new Date().getHours());
    this.$('[data-avatar]').textContent = profile?.avatar ?? '📚';
    this.$('[data-hello]').textContent = profile ? `${hello}, ${profile.displayName}` : `${hello}!`;
    const sub = this.$('[data-sub]');
    if (shelf.current) {
      const title = document.createElement('cite');
      title.textContent = shelf.current.title;
      sub.replaceChildren('On the nightstand: ', title, '.');
    } else if (!profile) {
      sub.innerHTML = 'New here? <a href="#profile">Fill in your reader’s card</a>.';
    } else {
      sub.textContent = 'Your card for today has been laid out.';
    }
  }
}
