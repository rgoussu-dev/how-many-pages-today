import { renderScene, SCENE_KINDS, type SceneKind } from './scene';

export { renderScene, SCENE_KINDS } from './scene';
export type { Scene, SceneKind } from './scene';

/**
 * `<hmpt-ds-scene seed="123" [kind="lamp"]>` — the card illustration. Domain-blind: a seed
 * in, a picture out; `kind` pins which scene. Light DOM, like planks, so the theme cascades in.
 */
export class SceneElement extends HTMLElement {
  static readonly observedAttributes = ['seed', 'kind'];

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
    const scene = renderScene(seed, only);
    this.setAttribute('aria-label', scene.label);
    this.dataset.kind = scene.kind;
    // Safe: the markup is generated from numbers only — no user text reaches it.
    this.innerHTML = scene.svg;
  }
}

/** Registers the design system's elements. Called once, by the assembly point. */
export function defineDesignSystem(registry: CustomElementRegistry = customElements): void {
  registry.define('hmpt-ds-scene', SceneElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'hmpt-ds-scene': SceneElement;
  }
}
