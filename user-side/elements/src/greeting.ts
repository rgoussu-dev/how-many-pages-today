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

  #render({ profile }: ReadingSnapshot): void {
    const hello = salutation(new Date().getHours());
    this.$('[data-avatar]').textContent = profile?.avatar ?? '📚';
    this.$('[data-hello]').textContent = profile ? `${hello}, ${profile.displayName}` : `${hello}!`;
    const sub = this.$('[data-sub]');
    if (!profile) {
      sub.innerHTML = 'New here? <a href="#profile">Set up your reader profile</a>.';
    } else if (profile.currentBook) {
      sub.textContent = `Currently reading ${profile.currentBook}.`;
    } else {
      sub.textContent = 'Here is your card for today.';
    }
  }
}
