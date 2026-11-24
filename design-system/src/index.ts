import { renderBookmark } from './bookmark';
import { renderScene, SCENE_KINDS, type SceneKind } from './scene';

export { renderBookmark, BOOKMARK_WOODS } from './bookmark';
export type { BookmarkPainting, BookmarkWood } from './bookmark';

export { renderScene, SCENE_KINDS, SCENE_LANGUAGES } from './scene';
export type { Scene, SceneKind, SceneLanguage } from './scene';

/**
 * `<hmpt-ds-scene seed="123" [kind="lamp"] [lang="fr"]>` — the card illustration.
 * Domain-blind: a seed in, a picture out; `kind` pins which scene, `lang` the language of
 * its description (else the nearest `lang` up the document). Light DOM, like planks, so the
 * theme cascades in.
 */
export class SceneElement extends HTMLElement {
  static readonly observedAttributes = ['seed', 'kind', 'lang'];

  attributeChangedCallback(): void {
    this.#paint();
  }

  connectedCallback(): void {
    this.setAttribute('role', 'img');
    this.#paint();
  }

  #paint(): void {
    const seed = Number(this.getAttribute('seed'));
    if (!Number.isFinite(seed)) return;
    const kind = this.getAttribute('kind');
    const only = (SCENE_KINDS as readonly string[]).includes(kind ?? '') ? (kind as SceneKind) : undefined;
    const lang = this.closest('[lang]')?.getAttribute('lang') ?? undefined;
    const scene = renderScene(seed, only, lang);
    this.setAttribute('aria-label', scene.label);
    this.dataset.kind = scene.kind;
    // Safe: the markup is generated from numbers only — no user text reaches it.
    this.innerHTML = scene.svg;
  }
}

/**
 * `<hmpt-ds-bookmark seed="123" mark="p. 112" [side="right"]>` — a painted bookmark with a
 * silk tassel, `mark` written in a gilt cartouche near its top. Domain-blind: a seed and a
 * few words in. `side="right"` draws it for a book lying on its back (the tassel mirrored,
 * the words not). Size it with `--bookmark-width` (the card's width); the tassel spills
 * out to its left and above, inside the element's box.
 */
export class BookmarkElement extends HTMLElement {
  static readonly observedAttributes = ['seed', 'mark'];
  #painted: number | null = null;

  attributeChangedCallback(name: string): void {
    if (name === 'seed') this.#paint();
    else this.#write();
  }

  connectedCallback(): void {
    this.#paint();
  }

  #paint(): void {
    const seed = Number(this.getAttribute('seed'));
    if (!Number.isFinite(seed) || seed === this.#painted) return;
    this.#painted = seed;
    // Safe: the markup is generated from numbers only. The mark goes in as text.
    this.innerHTML = `${renderBookmark(seed).svg}<span class="ds-bookmark-mark"></span>`;
    this.#write();
  }

  #write(): void {
    const mark = this.querySelector('.ds-bookmark-mark');
    if (!mark) return;
    const text = this.getAttribute('mark') ?? '';
    mark.textContent = text;
    mark.toggleAttribute('hidden', text === '');
    mark.toggleAttribute('data-long', text.length > 6);
  }
}

/** Registers the design system's elements. Called once, by the assembly point. */
export function defineDesignSystem(registry: CustomElementRegistry = customElements): void {
  registry.define('hmpt-ds-scene', SceneElement);
  registry.define('hmpt-ds-bookmark', BookmarkElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'hmpt-ds-scene': SceneElement;
    'hmpt-ds-bookmark': BookmarkElement;
  }
}
