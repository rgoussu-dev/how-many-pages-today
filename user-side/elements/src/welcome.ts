import {
  AVATARS,
  type BookshelfPort,
  type InstallAvailability,
  type ProfilePort,
  type ReadingView,
  type WelcomePort,
} from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { showFieldErrors } from './forms';
import { plural } from './format';
import { PortBoundElement } from './port-bound';

type Chapter = 'door' | 'card' | 'nightstand' | 'install' | 'finale';

type Step =
  | { readonly kind: 'chapter'; readonly chapter: Chapter }
  | { readonly kind: 'spot'; readonly target: HTMLElement; readonly title: string; readonly text: string };

/** Each chapter gets its own plate. */
const PLATES: Record<Chapter, { seed: number; kind: string }> = {
  door: { seed: 1871, kind: 'shelves' },
  card: { seed: 1813, kind: 'lamp' },
  nightstand: { seed: 1847, kind: 'armchair' },
  install: { seed: 1926, kind: 'window' },
  finale: { seed: 1605, kind: 'still-life' },
};

const SHARE_ICON =
  '<svg class="welcome-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0-4 4m4-4 4 4M7 10H5v11h14V10h-2"/></svg>';

/**
 * `<hmpt-welcome>` — the first visit, told as a short story by the librarian: the door, the
 * reader's card, the book on the nightstand, a lamplit tour of the room (a spotlight on the
 * real interface), a key to the room (installing the app), and the first card.
 *
 * The tour's stops are declared by the shell: any element with `data-tour="<order>"`,
 * `data-tour-title` and `data-tour-text`. The element never needs to know the page layout.
 */
export class Welcome extends PortBoundElement {
  #welcome?: WelcomePort;
  #profile?: ProfilePort;
  #shelf?: BookshelfPort;
  #view?: ReadingView;
  #steps: Step[] = [];
  #index = -1;
  /** True from start to close; a save that lands after the reader skipped must not turn the page. */
  #running = false;
  #install: InstallAvailability = 'manual';
  #inerted: Element[] = [];
  /** Bookplates earned during the walkthrough — the librarian mentions them at the end. */
  #earned: string[] = [];
  #reposition = () => this.#placeSpot();
  #keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.#running) void this.#finish();
  };

  protected markup(): string {
    return /* html */ `
      <div class="welcome" data-root hidden>
        <div class="welcome-veil" data-veil></div>
        <div class="welcome-spot" data-spot hidden></div>
        <section class="welcome-page surface" data-page role="dialog" aria-modal="true" aria-labelledby="welcome-title" hidden>
          <div class="welcome-plate"><frame-pk ratio="16:9"><hmpt-ds-scene></hmpt-ds-scene></frame-pk></div>
          <div class="welcome-body" data-body></div>
          <p class="welcome-progress" data-progress aria-hidden="true"></p>
        </section>
        <section class="welcome-bubble surface" data-bubble role="dialog" aria-modal="true" aria-labelledby="welcome-bubble-title" hidden>
          <p class="eyebrow" data-bubble-count></p>
          <h2 id="welcome-bubble-title" tabindex="-1" data-bubble-title></h2>
          <p class="welcome-speech" data-bubble-text></p>
          <div class="welcome-actions">
            <button type="button" class="btn btn-quiet" data-back>Back</button>
            <button type="button" class="btn btn-primary" data-next>Next</button>
          </div>
          <button type="button" class="welcome-skip" data-skip>Skip the tour</button>
        </section>
      </div>`;
  }

  protected override setup(): void {
    this.$('[data-bubble] [data-next]').addEventListener('click', () => void this.#go(this.#index + 1));
    this.$('[data-bubble] [data-back]').addEventListener('click', () => void this.#go(this.#index - 1));
    this.$('[data-bubble] [data-skip]').addEventListener('click', () => void this.#finish());
    // Chapters are re-rendered on every visit: delegate their buttons.
    this.$('[data-body]').addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'next') void this.#go(this.#index + 1);
      if (action === 'skip' || action === 'finish') void this.#finish();
      if (action === 'install') void this.#runInstall();
    });
    this.$('[data-body]').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      if (form.dataset.form === 'card') void this.#signCard(form);
      if (form.dataset.form === 'nightstand') void this.#startBook(form);
    });
  }

  protected connect() {
    this.#welcome = this.request(readingContexts.welcome);
    this.#profile = this.request(readingContexts.profile);
    this.#shelf = this.request(readingContexts.bookshelf);
    this.#view = this.request(readingContexts.view);
    void this.#welcome.needed().then((needed) => {
      if (needed) void this.#start();
    });
    return [
      this.#view.onEvent((event) => {
        if (event.type === 'welcome-requested') void this.#start();
        if (event.type === 'achievement-unlocked' && this.#running) this.#earned.push(event.achievement.title);
      }),
      () => this.#close(),
    ];
  }

  // — flow ———————————————————————————————————————————————————————————————————————

  async #start(): Promise<void> {
    if (this.#running || !this.#welcome) return;
    this.#running = true;
    this.#install = await this.#welcome.installAvailability();
    const stops = [...document.querySelectorAll<HTMLElement>('[data-tour]')]
      .sort((a, b) => Number(a.dataset.tour) - Number(b.dataset.tour))
      .map<Step>((target) => ({
        kind: 'spot',
        target,
        title: target.dataset.tourTitle ?? '',
        text: target.dataset.tourText ?? '',
      }));
    this.#steps = [
      { kind: 'chapter', chapter: 'door' },
      { kind: 'chapter', chapter: 'card' },
      { kind: 'chapter', chapter: 'nightstand' },
      ...stops,
      ...(this.#install === 'installed' ? [] : [{ kind: 'chapter', chapter: 'install' } as const]),
      { kind: 'chapter', chapter: 'finale' },
    ];
    if (location.hash && location.hash !== '#today') location.hash = '#today';
    this.#earned = [];
    this.#open();
    await this.#go(0);
  }

  async #go(index: number): Promise<void> {
    const step = this.#steps[index];
    if (!step || !this.#running) return;
    this.#index = index;
    const root = this.$('[data-root]');
    root.dataset.mode = step.kind;
    if (step.kind === 'chapter') this.#showChapter(step.chapter);
    else this.#showSpot(step);
  }

  async #finish(): Promise<void> {
    this.#close();
    await this.#welcome?.finish();
  }

  #open(): void {
    this.$('[data-root]').hidden = false;
    document.documentElement.dataset.welcoming = '';
    // Everything else on the page is out of reach while the librarian speaks.
    this.#inerted = [...document.body.children].filter((el) => el !== this && !(el as HTMLElement).inert);
    for (const el of this.#inerted) (el as HTMLElement).inert = true;
    document.addEventListener('keydown', this.#keydown);
    window.addEventListener('resize', this.#reposition);
    window.addEventListener('scroll', this.#reposition, { passive: true });
  }

  #close(): void {
    this.#running = false;
    this.#index = -1;
    this.$('[data-root]').hidden = true;
    delete document.documentElement.dataset.welcoming;
    for (const el of this.#inerted) (el as HTMLElement).inert = false;
    this.#inerted = [];
    document.removeEventListener('keydown', this.#keydown);
    window.removeEventListener('resize', this.#reposition);
    window.removeEventListener('scroll', this.#reposition);
  }

  // — chapters (a page of the story) ——————————————————————————————————————————————

  #showChapter(chapter: Chapter): void {
    this.$('[data-bubble]').hidden = true;
    this.$('[data-spot]').hidden = true;
    for (const target of document.querySelectorAll('[data-tour-lit]')) target.removeAttribute('data-tour-lit');
    const page = this.$('[data-page]');
    page.hidden = false;
    page.dataset.chapter = chapter;
    // Chapters with a form get a slimmer plate, so the form fits on a small phone.
    this.$('[data-page] frame-pk').setAttribute('ratio', chapter === 'card' || chapter === 'nightstand' ? '3:1' : '16:9');
    const scene = this.$('[data-page] hmpt-ds-scene');
    scene.setAttribute('kind', PLATES[chapter].kind);
    scene.setAttribute('seed', String(PLATES[chapter].seed));
    const body = this.$('[data-body]');
    body.innerHTML = this.#chapterMarkup(chapter); // static copy only — reader's text goes in via .value/.textContent
    this.#fillChapter(chapter, body);
    this.#progress();
    // turn the page
    page.removeAttribute('data-turn');
    void page.offsetWidth;
    page.setAttribute('data-turn', '');
    body.querySelector<HTMLElement>('h2')?.focus();
  }

  #chapterMarkup(chapter: Chapter): string {
    const voice = `<p class="welcome-voice"><span class="welcome-owl" aria-hidden="true">🦉</span> The librarian</p>`;
    switch (chapter) {
      case 'door':
        return `
          <p class="eyebrow">A door creaks open…</p>
          <h2 id="welcome-title" tabindex="-1">The reading room</h2>
          ${voice}
          <p class="welcome-speech">“Ah — a new reader. Do come in, and mind the dust. I keep this little library, and every day I deal one card: a picture, and a number of pages to read. That is all there is to it — and it is quite enough.”</p>
          <div class="welcome-actions">
            <button type="button" class="btn btn-quiet" data-action="skip">I know my way</button>
            <button type="button" class="btn btn-primary" data-action="next">Step inside</button>
          </div>`;
      case 'card': {
        const avatars = AVATARS.map(
          (a, i) =>
            `<label class="avatar-option"><input type="radio" name="avatar" value="${a}"${i === 1 ? ' checked' : ''}><span>${a}</span></label>`,
        ).join('');
        return `
          <p class="eyebrow">First, the register</p>
          <h2 id="welcome-title" tabindex="-1">Your reader’s card</h2>
          ${voice}
          <p class="welcome-speech">“Every reader here has one. It never leaves this room — nothing you tell me is sent anywhere.”</p>
          <form novalidate data-form="card" class="welcome-form">
            <fieldset class="avatar-picker">
              <legend class="field-legend">Pick a portrait</legend>
              <cluster-pk space="var(--s-2)">${avatars}</cluster-pk>
              <p class="field-error" data-error="avatar"></p>
            </fieldset>
            <label class="field"><span>What shall I call you?</span>
              <input name="displayName" autocomplete="nickname" maxlength="40" required>
              <p class="field-error" data-error="displayName"></p>
            </label>
            <label class="field"><span>A favourite genre? <em>(optional)</em></span>
              <input name="favouriteGenre" maxlength="60" placeholder="Poetry, crime, science fiction…">
              <p class="field-error" data-error="favouriteGenre"></p>
            </label>
            <div class="welcome-actions">
              <button type="button" class="btn btn-quiet" data-action="next">Later</button>
              <button type="submit" class="btn btn-primary">Sign the register</button>
            </div>
          </form>`;
      }
      case 'nightstand':
        return `
          <p class="eyebrow">And on your nightstand?</p>
          <h2 id="welcome-title" tabindex="-1">The book in hand</h2>
          ${voice}
          <p class="welcome-speech" data-greet>“What are you reading at the moment? I shall keep it on your nightstand until the last page — then it goes on your shelf.”</p>
          <form novalidate data-form="nightstand" class="welcome-form">
            <label class="field"><span>The book you are reading</span>
              <input name="title" maxlength="120" autocomplete="off" placeholder="Title">
              <p class="field-error" data-error="title"></p>
            </label>
            <div class="welcome-actions">
              <button type="button" class="btn btn-quiet" data-action="next">Nothing just now</button>
              <button type="submit" class="btn btn-primary">Put it on the nightstand</button>
            </div>
          </form>`;
      case 'install':
        return `
          <p class="eyebrow">One last thing</p>
          <h2 id="welcome-title" tabindex="-1">A key to the room</h2>
          ${voice}
          <p class="welcome-speech">“Keep the reading room on your home screen: it opens like any app, works without a connection, and can remind you when it is time to read.”</p>
          ${this.#installMarkup()}
          <p class="status" role="status" data-install-status></p>`;
      case 'finale':
        return `
          <p class="eyebrow">Now then</p>
          <h2 id="welcome-title" tabindex="-1">Your first card awaits</h2>
          ${voice}
          <p class="welcome-speech" data-finale></p>
          <div class="welcome-actions welcome-actions-end">
            <button type="button" class="btn btn-primary" data-action="finish">Turn the first page</button>
          </div>`;
    }
  }

  #installMarkup(): string {
    switch (this.#install) {
      case 'prompt':
        return `
          <div class="welcome-actions">
            <button type="button" class="btn btn-quiet" data-action="next">Not now</button>
            <button type="button" class="btn btn-primary" data-action="install">Add it to my home screen</button>
          </div>`;
      case 'ios':
        return `
          <ol class="welcome-steps">
            <li>Tap the <strong>Share</strong> button ${SHARE_ICON} in Safari’s toolbar.</li>
            <li>Scroll down and choose <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong>. The key is yours.</li>
          </ol>
          <div class="welcome-actions">
            <button type="button" class="btn btn-quiet" data-action="next">Not now</button>
            <button type="button" class="btn btn-primary" data-action="next">Done</button>
          </div>`;
      default:
        return `
          <p class="welcome-note">In your browser’s menu, look for <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
          <div class="welcome-actions">
            <button type="button" class="btn btn-quiet" data-action="next">Not now</button>
            <button type="button" class="btn btn-primary" data-action="next">Onward</button>
          </div>`;
    }
  }

  /** Puts what the app already knows into the chapter — always as values, never as markup. */
  #fillChapter(chapter: Chapter, body: HTMLElement): void {
    const snapshot = this.#view?.current();
    if (chapter === 'card' && snapshot?.profile) {
      const form = body.querySelector<HTMLFormElement>('form')!;
      (form.elements.namedItem('displayName') as HTMLInputElement).value = snapshot.profile.displayName;
      (form.elements.namedItem('favouriteGenre') as HTMLInputElement).value = snapshot.profile.favouriteGenre;
      for (const radio of form.querySelectorAll<HTMLInputElement>('input[name="avatar"]')) {
        radio.checked = radio.value === snapshot.profile.avatar;
      }
    }
    if (chapter === 'nightstand') {
      if (snapshot?.profile) {
        body.querySelector('[data-greet]')!.textContent =
          `“A pleasure, ${snapshot.profile.displayName}. What are you reading at the moment? I shall keep it on your nightstand until the last page — then it goes on your shelf.”`;
      }
      if (snapshot?.shelf.current) {
        body.querySelector<HTMLInputElement>('input[name="title"]')!.value = snapshot.shelf.current.title;
      }
    }
    if (chapter === 'finale' && snapshot) {
      const name = snapshot.profile ? `, ${snapshot.profile.displayName}` : '';
      const bookplate =
        this.#earned.length === 0
          ? ''
          : this.#earned.length === 1
            ? ` Oh — and you have already earned your first bookplate: “${this.#earned[0]}”.`
            : ` Oh — and you have already earned ${this.#earned.length} bookplates.`;
      body.querySelector('[data-finale]')!.textContent =
        `“Today’s card is on the table${name}: ${plural(snapshot.today.pages, 'page')}. Read them, and press the button — I shall seal the day with wax.${bookplate} Take your time; the lamp is lit.”`;
    }
  }

  async #signCard(form: HTMLFormElement): Promise<void> {
    if (!this.#profile) return;
    const data = new FormData(form);
    const result = await this.#profile.save({
      displayName: String(data.get('displayName') ?? ''),
      avatar: String(data.get('avatar') ?? ''),
      favouriteGenre: String(data.get('favouriteGenre') ?? ''),
    });
    showFieldErrors(form, result.ok ? [] : result.error);
    if (result.ok) await this.#go(this.#index + 1);
  }

  async #startBook(form: HTMLFormElement): Promise<void> {
    if (!this.#shelf) return;
    const title = (form.elements.namedItem('title') as HTMLInputElement).value;
    if (title.trim() === '') return this.#go(this.#index + 1);
    const result = await this.#shelf.startReading(title);
    showFieldErrors(form, result.ok ? [] : result.error);
    if (result.ok) await this.#go(this.#index + 1);
  }

  async #runInstall(): Promise<void> {
    if (!this.#welcome) return;
    const outcome = await this.#welcome.install();
    const status = this.querySelector<HTMLElement>('[data-install-status]');
    if (status) {
      status.dataset.tone = outcome === 'accepted' ? 'ok' : 'warn';
      status.textContent =
        outcome === 'accepted' ? '“Splendid. The key is on your home screen.”' : '“Another time, then. The door is always open.”';
    }
    const install = this.querySelector<HTMLButtonElement>('[data-action="install"]');
    if (install) {
      install.textContent = 'Onward';
      install.dataset.action = 'next';
    }
  }

  // — the tour (a spotlight on the real room) ————————————————————————————————————

  #showSpot(step: Extract<Step, { kind: 'spot' }>): void {
    this.$('[data-page]').hidden = true;
    const spots = this.#steps.filter((s) => s.kind === 'spot');
    const n = spots.indexOf(step) + 1;
    this.$('[data-bubble-count]').textContent = `A tour of the room · ${n} of ${spots.length}`;
    this.$('[data-bubble-title]').textContent = step.title;
    this.$('[data-bubble-text]').textContent = step.text;
    this.$<HTMLButtonElement>('[data-bubble] [data-back]').hidden = n === 1;
    this.$('[data-bubble] [data-next]').textContent = n === spots.length ? 'Onward' : 'Next';
    for (const target of document.querySelectorAll('[data-tour-lit]')) target.removeAttribute('data-tour-lit');
    step.target.setAttribute('data-tour-lit', '');
    step.target.scrollIntoView({ block: 'center', behavior: 'instant' });
    this.$('[data-spot]').hidden = false;
    const bubble = this.$('[data-bubble]');
    bubble.hidden = false;
    bubble.removeAttribute('data-turn');
    void bubble.offsetWidth;
    bubble.setAttribute('data-turn', '');
    this.#placeSpot();
    this.#progress();
    this.$('[data-bubble-title]').focus({ preventScroll: true });
  }

  #placeSpot(): void {
    const step = this.#steps[this.#index];
    if (!step || step.kind !== 'spot') return;
    const pad = 8;
    const gap = 16;
    const bubble = this.$('[data-bubble]');
    const height = bubble.offsetHeight;
    let rect = step.target.getBoundingClientRect();
    const fitsWithBubble = rect.height + pad * 2 + gap * 3 + height <= innerHeight;
    let top: number;
    if (fitsWithBubble) {
      const below = rect.bottom + pad + gap;
      const above = rect.top - pad - gap - height;
      top = below + height <= innerHeight - gap ? below : above >= gap ? above : innerHeight - height - gap;
    } else {
      // A tall stop (the day's card): keep its lower part — the pages and the button — in
      // view at the bottom of the screen, and let the bubble rest over its top.
      const bottomLine = innerHeight - this.#bottomInset() - gap;
      if (Math.abs(rect.bottom + pad - bottomLine) > 1) {
        window.scrollBy({ top: rect.bottom + pad - bottomLine, behavior: 'instant' });
        rect = step.target.getBoundingClientRect();
      }
      top = gap;
    }
    top = Math.max(gap, Math.min(top, innerHeight - height - gap));
    bubble.style.top = `${top}px`;

    const spot = this.$('[data-spot]');
    spot.style.top = `${rect.top - pad}px`;
    spot.style.left = `${rect.left - pad}px`;
    spot.style.width = `${rect.width + pad * 2}px`;
    spot.style.height = `${rect.height + pad * 2}px`;
  }

  /** How much of the bottom of the screen is covered by fixed chrome (the tab bar). */
  #bottomInset(): number {
    // Inert elements escape hit-testing, so look for a fixed bar pinned to the bottom instead.
    const fixed = [...document.querySelectorAll<HTMLElement>('nav, footer')].find((el) => {
      if (this.contains(el) || getComputedStyle(el).position !== 'fixed') return false;
      const box = el.getBoundingClientRect();
      return box.height > 0 && Math.abs(box.bottom - innerHeight) < 2;
    });
    return fixed ? fixed.getBoundingClientRect().height : 0;
  }

  #progress(): void {
    const dots = this.#steps.map((_, i) => (i === this.#index ? '●' : i < this.#index ? '•' : '·')).join(' ');
    this.$('[data-progress]').textContent = dots;
  }
}

/** `<hmpt-welcome-replay>` — a quiet link to take the tour again. */
export class WelcomeReplay extends PortBoundElement {
  #welcome?: WelcomePort;

  protected markup(): string {
    return `<button type="button" class="btn btn-quiet welcome-replay">🦉 Take the tour again</button>`;
  }

  protected override setup(): void {
    this.$('button').addEventListener('click', () => void this.#welcome?.replay());
  }

  protected connect() {
    this.#welcome = this.request(readingContexts.welcome);
    return [];
  }
}
