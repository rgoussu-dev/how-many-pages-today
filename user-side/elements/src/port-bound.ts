import { ContextRequestEvent, type Context } from '@hmpt/kernel/context';

const templates = new WeakMap<object, HTMLTemplateElement>();

/**
 * Base for every port-bound element. Light DOM on purpose: the layout comes from planks,
 * whose structural CSS is tag-scoped in the document — a shadow root would wall it out.
 *
 * Lifecycle: the markup is cloned once (first connection) and `setup()` binds DOM
 * listeners once; `connect()` runs on every connection, requests ports and returns the
 * subscriptions to undo on disconnection.
 */
export abstract class PortBoundElement extends HTMLElement {
  #rendered = false;
  #cleanups: Array<() => void> = [];

  protected abstract markup(): string;
  protected setup(): void {}
  protected abstract connect(): Array<() => void>;

  connectedCallback(): void {
    if (!this.#rendered) {
      this.replaceChildren(this.#template().content.cloneNode(true));
      this.#rendered = true;
      this.setup();
    }
    this.#cleanups = this.connect();
  }

  disconnectedCallback(): void {
    this.#cleanups.forEach((cleanup) => cleanup());
    this.#cleanups = [];
  }

  /** Requests a port through the Context protocol and fails fast when nobody answers. */
  protected request<T>(context: Context<T>): T {
    let value: T | undefined;
    this.dispatchEvent(new ContextRequestEvent(context, (provided) => (value = provided)));
    if (value === undefined) throw new Error(`<${this.localName}>: no provider for ${context.name}`);
    return value;
  }

  protected $<E extends Element = HTMLElement>(selector: string): E {
    const found = this.querySelector<E>(selector);
    if (!found) throw new Error(`<${this.localName}>: missing ${selector}`);
    return found;
  }

  #template(): HTMLTemplateElement {
    const key = this.constructor;
    let template = templates.get(key);
    if (!template) {
      template = document.createElement('template');
      template.innerHTML = this.markup();
      templates.set(key, template);
    }
    return template;
  }
}
