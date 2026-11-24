import {
  AVATARS,
  LANGUAGES,
  type BookshelfPort,
  type InstallAvailability,
  type LanguageChoice,
  type LanguagePort,
  type ProfilePort,
  type ReadingView,
  type WelcomePort,
  type AchievementId,
} from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { showFieldErrors, typedNumber } from './forms';
import { LANGUAGE_NAMES, deviceSpeech, speech, type Messages, type Speech } from './i18n';
import { PortBoundElement } from './port-bound';

type Chapter = 'door' | 'card' | 'nightstand' | 'install' | 'finale';

/** The stops the shell may mark with `data-tour-stop` — their words are in the phrasebook. */
type Stop = keyof Messages['tour'];

type Step =
  | { readonly kind: 'chapter'; readonly chapter: Chapter }
  | { readonly kind: 'spot'; readonly target: HTMLElement; readonly stop: Stop };

const isStop = (value: string | undefined, t: Messages): value is Stop => value !== undefined && value in t.tour;

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
 * The tour's stops are declared by the shell: any element with `data-tour="<order>"` and
 * `data-tour-stop="<stop>"`, a stop the phrasebook words (`tour.<stop>`). The element never
 * needs to know the page layout.
 */
export class Welcome extends PortBoundElement {
  #welcome?: WelcomePort;
  #profile?: ProfilePort;
  #shelf?: BookshelfPort;
  #language?: LanguagePort;
  #view?: ReadingView;
  /** The language the open page was written in — it is rewritten when that changes. */
  #writtenIn: Speech | null = null;
  #steps: Step[] = [];
  #index = -1;
  /** True from start to close; a save that lands after the reader skipped must not turn the page. */
  #running = false;
  #install: InstallAvailability = 'manual';
  #inerted: Element[] = [];
  /** Bookplates earned during the walkthrough — the librarian mentions them at the end. */
  #earned: AchievementId[] = [];
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
            <button type="button" class="btn btn-quiet" data-back data-t="welcome.back"></button>
            <button type="button" class="btn btn-primary" data-next></button>
          </div>
          <button type="button" class="welcome-skip" data-skip data-t="welcome.skipTour"></button>
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
    this.$('[data-body]').addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (input.name === 'language') void this.#language?.choose(input.value as LanguageChoice);
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
    this.#language = this.request(readingContexts.language);
    this.#view = this.request(readingContexts.view);
    // Hold the rest of the room (the day's card waits closed) until we know whether to speak.
    if (!this.#running) document.documentElement.dataset.welcoming = 'deciding';
    void this.#welcome.needed().then((needed) => {
      if (needed) void this.#start();
      else if (!this.#running) delete document.documentElement.dataset.welcoming;
    });
    return [
      this.#view.subscribe(({ language }) => {
        const words = this.speak(language);
        // A new language while the librarian speaks: the open page is written again in it.
        if (this.#running && this.#writtenIn !== words) void this.#go(this.#index);
      }),
      this.#view.onEvent((event) => {
        if (event.type === 'welcome-requested') void this.#start();
        if (event.type === 'achievement-unlocked' && this.#running) this.#earned.push(event.achievement.id);
      }),
      () => this.#close(),
    ];
  }

  // — flow ———————————————————————————————————————————————————————————————————————

  async #start(): Promise<void> {
    if (this.#running || !this.#welcome) return;
    this.#running = true;
    this.#install = await this.#welcome.installAvailability();
    const { t } = this.#words();
    const stops = [...document.querySelectorAll<HTMLElement>('[data-tour]')]
      .sort((a, b) => Number(a.dataset.tour) - Number(b.dataset.tour))
      .flatMap<Step>((target) => {
        const stop = target.dataset.tourStop;
        return isStop(stop, t) ? [{ kind: 'spot', target, stop }] : [];
      });
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

  #words(): Speech {
    const language = this.#view?.current()?.language;
    return language ? speech(language) : deviceSpeech();
  }

  async #go(index: number): Promise<void> {
    const step = this.#steps[index];
    if (!step || !this.#running) return;
    this.#index = index;
    this.#writtenIn = this.#words();
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
    document.documentElement.dataset.welcoming = 'speaking';
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
    window.scrollTo({ top: 0, behavior: 'instant' }); // back to the day's card
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
    const words = this.#words();
    scene.setAttribute('lang', words.language);
    body.innerHTML = this.#chapterMarkup(chapter, words); // static copy only — reader's text goes in via .value/.textContent
    this.#fillChapter(chapter, body, words.t);
    this.#progress();
    // turn the page
    page.removeAttribute('data-turn');
    void page.offsetWidth;
    page.setAttribute('data-turn', '');
    body.querySelector<HTMLElement>('h2')?.focus();
  }

  /** A chapter's static copy, from the phrasebook — the reader's own text goes in later, as values. */
  #chapterMarkup(chapter: Chapter, { t }: Speech): string {
    const w = t.welcome;
    const voice = `<p class="welcome-voice"><span class="welcome-owl" aria-hidden="true">🦉</span> ${w.librarian}</p>`;
    const optional = `<em>${t.common.optional}</em>`;
    switch (chapter) {
      case 'door': {
        // Each language is named in itself, so a reader lost in the wrong one can find theirs.
        const languages = LANGUAGES.map(
          (code) =>
            `<label class="choice"><input type="radio" name="language" value="${code}"><span lang="${code}">${LANGUAGE_NAMES[code]}</span></label>`,
        ).join('');
        return `
          <p class="eyebrow">${w.door.eyebrow}</p>
          <h2 id="welcome-title" tabindex="-1">${w.door.heading}</h2>
          ${voice}
          <p class="welcome-speech">${w.door.speech}</p>
          <fieldset class="choices welcome-languages">
            <legend class="visually-hidden">${w.door.languages}</legend>
            ${languages}
          </fieldset>
          <div class="welcome-actions">
            <button type="button" class="btn btn-quiet" data-action="skip">${w.door.skip}</button>
            <button type="button" class="btn btn-primary" data-action="next">${w.door.enter}</button>
          </div>`;
      }
      case 'card': {
        const avatars = AVATARS.map(
          (a, i) =>
            `<label class="avatar-option"><input type="radio" name="avatar" value="${a}"${i === 1 ? ' checked' : ''}><span>${a}</span></label>`,
        ).join('');
        return `
          <p class="eyebrow">${w.card.eyebrow}</p>
          <h2 id="welcome-title" tabindex="-1">${w.card.heading}</h2>
          ${voice}
          <p class="welcome-speech">${w.card.speech}</p>
          <form novalidate data-form="card" class="welcome-form">
            <fieldset class="avatar-picker">
              <legend class="field-legend">${w.card.portrait}</legend>
              <cluster-pk space="var(--s-2)">${avatars}</cluster-pk>
              <p class="field-error" data-error="avatar"></p>
            </fieldset>
            <label class="field"><span>${w.card.name}</span>
              <input name="displayName" autocomplete="nickname" maxlength="40" required>
              <p class="field-error" data-error="displayName"></p>
            </label>
            <label class="field"><span>${w.card.genre} ${optional}</span>
              <input name="favouriteGenre" maxlength="60" placeholder="${w.card.genrePlaceholder}">
              <p class="field-error" data-error="favouriteGenre"></p>
            </label>
            <div class="welcome-actions">
              <button type="button" class="btn btn-quiet" data-action="next">${w.card.later}</button>
              <button type="submit" class="btn btn-primary">${w.card.sign}</button>
            </div>
          </form>`;
      }
      case 'nightstand':
        return `
          <p class="eyebrow">${w.nightstand.eyebrow}</p>
          <h2 id="welcome-title" tabindex="-1">${w.nightstand.heading}</h2>
          ${voice}
          <p class="welcome-speech" data-greet>${w.nightstand.speech}</p>
          <form novalidate data-form="nightstand" class="welcome-form">
            <label class="field"><span>${w.nightstand.book}</span>
              <input name="title" maxlength="120" autocomplete="off" placeholder="${t.common.title}">
              <p class="field-error" data-error="title"></p>
            </label>
            <div class="book-pages">
              <label class="field"><span>${w.nightstand.onPage} ${optional}</span>
                <input name="bookmark" type="number" inputmode="numeric" min="0" max="20000" step="1" placeholder="${t.shelf.fromTheStart}">
              </label>
              <label class="field"><span>${w.nightstand.totalPages} ${optional}</span>
                <input name="totalPages" type="number" inputmode="numeric" min="1" max="20000" step="1">
              </label>
            </div>
            <p class="field-error" data-error="bookmark"></p>
            <p class="field-error" data-error="totalPages"></p>
            <div class="welcome-actions">
              <button type="button" class="btn btn-quiet" data-action="next">${w.nightstand.nothing}</button>
              <button type="submit" class="btn btn-primary">${w.nightstand.put}</button>
            </div>
          </form>`;
      case 'install':
        return `
          <p class="eyebrow">${w.install.eyebrow}</p>
          <h2 id="welcome-title" tabindex="-1">${w.install.heading}</h2>
          ${voice}
          <p class="welcome-speech">${w.install.speech}</p>
          ${this.#installMarkup(t)}
          <p class="status" role="status" data-install-status></p>`;
      case 'finale':
        return `
          <p class="eyebrow">${w.finale.eyebrow}</p>
          <h2 id="welcome-title" tabindex="-1">${w.finale.heading}</h2>
          ${voice}
          <p class="welcome-speech" data-finale></p>
          <div class="welcome-actions welcome-actions-end">
            <button type="button" class="btn btn-primary" data-action="finish">${w.finale.begin}</button>
          </div>`;
    }
  }

  #installMarkup(t: Messages): string {
    const w = t.welcome.install;
    switch (this.#install) {
      case 'prompt':
        return `
          <div class="welcome-actions">
            <button type="button" class="btn btn-quiet" data-action="next">${w.notNow}</button>
            <button type="button" class="btn btn-primary" data-action="install">${w.add}</button>
          </div>`;
      case 'ios':
        return `
          <ol class="welcome-steps">
            <li>${w.iosShare}<strong>${w.iosShareButton}</strong> ${SHARE_ICON}${w.iosShareEnd}</li>
            <li>${w.iosScroll}<strong>${w.iosAddToHome}</strong>.</li>
            <li>${w.iosAdd}<strong>${w.iosAddButton}</strong>${w.iosAddEnd}</li>
          </ol>
          <div class="welcome-actions">
            <button type="button" class="btn btn-quiet" data-action="next">${w.notNow}</button>
            <button type="button" class="btn btn-primary" data-action="next">${w.done}</button>
          </div>`;
      default:
        return `
          <p class="welcome-note">${w.menu}<strong>${w.menuInstall}</strong>${w.menuOr}<strong>${w.menuAddHome}</strong>.</p>
          <div class="welcome-actions">
            <button type="button" class="btn btn-quiet" data-action="next">${w.notNow}</button>
            <button type="button" class="btn btn-primary" data-action="next">${t.welcome.onward}</button>
          </div>`;
    }
  }

  /** Puts what the app already knows into the chapter — always as values, never as markup. */
  #fillChapter(chapter: Chapter, body: HTMLElement, t: Messages): void {
    const snapshot = this.#view?.current();
    if (chapter === 'door' && snapshot) {
      for (const radio of body.querySelectorAll<HTMLInputElement>('input[name="language"]')) {
        radio.checked = radio.value === snapshot.language.language;
      }
    }
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
        body.querySelector('[data-greet]')!.textContent = t.welcome.nightstand.greet(snapshot.profile.displayName);
      }
      const book = snapshot?.shelf.current;
      if (book) {
        const field = (name: string) => body.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
        field('title').value = book.title;
        if (book.bookmark !== undefined) field('bookmark').value = String(book.bookmark);
        if (book.totalPages !== undefined) field('totalPages').value = String(book.totalPages);
      }
    }
    if (chapter === 'finale' && snapshot) {
      const f = t.welcome.finale;
      const [first] = this.#earned;
      const bookplate =
        first === undefined
          ? ''
          : this.#earned.length === 1
            ? f.oneBookplate(t.achievements.list[first].title)
            : f.bookplates(this.#earned.length);
      body.querySelector('[data-finale]')!.textContent = f.speech(
        snapshot.profile?.displayName ?? null,
        snapshot.today.pages,
        snapshot.readTo,
        bookplate,
      );
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
    showFieldErrors(form, result.ok ? [] : result.error, this.#words().t);
    if (result.ok) await this.#go(this.#index + 1);
  }

  async #startBook(form: HTMLFormElement): Promise<void> {
    if (!this.#shelf) return;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
    const title = field('title').value;
    if (title.trim() === '') return this.#go(this.#index + 1);
    const bookmark = typedNumber(field('bookmark'));
    const totalPages = typedNumber(field('totalPages'));
    const result = await this.#shelf.startReading({
      title,
      ...(bookmark === undefined ? {} : { bookmark }),
      ...(totalPages === undefined ? {} : { totalPages }),
    });
    showFieldErrors(form, result.ok ? [] : result.error, this.#words().t);
    if (result.ok) await this.#go(this.#index + 1);
  }

  async #runInstall(): Promise<void> {
    if (!this.#welcome) return;
    const outcome = await this.#welcome.install();
    const { t } = this.#words();
    const status = this.querySelector<HTMLElement>('[data-install-status]');
    if (status) {
      status.dataset.tone = outcome === 'accepted' ? 'ok' : 'warn';
      status.textContent = outcome === 'accepted' ? t.welcome.install.accepted : t.welcome.install.dismissed;
    }
    const install = this.querySelector<HTMLButtonElement>('[data-action="install"]');
    if (install) {
      install.textContent = t.welcome.onward;
      install.dataset.action = 'next';
    }
  }

  // — the tour (a spotlight on the real room) ————————————————————————————————————

  #showSpot(step: Extract<Step, { kind: 'spot' }>): void {
    this.$('[data-page]').hidden = true;
    const { t } = this.#words();
    const spots = this.#steps.filter((s) => s.kind === 'spot');
    const n = spots.indexOf(step) + 1;
    this.$('[data-bubble-count]').textContent = t.welcome.tourCount(n, spots.length);
    this.$('[data-bubble-title]').textContent = t.tour[step.stop].title;
    this.$('[data-bubble-text]').textContent = t.tour[step.stop].text;
    this.$<HTMLButtonElement>('[data-bubble] [data-back]').hidden = n === 1;
    this.$('[data-bubble] [data-next]').textContent = n === spots.length ? t.welcome.onward : t.welcome.next;
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
    return `<button type="button" class="btn btn-quiet welcome-replay" data-t="welcome.replay"></button>`;
  }

  protected override setup(): void {
    this.$('button').addEventListener('click', () => void this.#welcome?.replay());
  }

  protected connect() {
    this.#welcome = this.request(readingContexts.welcome);
    const view = this.request(readingContexts.view);
    return [view.subscribe(({ language }) => void this.speak(language))];
  }
}
