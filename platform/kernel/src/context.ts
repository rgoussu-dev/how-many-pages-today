/**
 * The Web Components Community Group Context protocol — the whole mechanism.
 *
 * The HTML parser constructs custom elements, so constructor injection is impossible.
 * Elements instead dispatch a bubbling, composed `context-request` event carrying a typed
 * key; the first ancestor that recognises the key answers synchronously through the
 * callback. In this app the provider is a plain listener registered by the assembly point
 * (application/pwa/src/main.ts), which answers from the port map it built.
 *
 * Kept apart from `index.ts` because it needs the DOM `Event` class: the domain imports
 * `@hmpt/kernel` and compiles without the DOM lib.
 */
export interface Context<T> {
  readonly name: string;
  /** Phantom field: carries T through the key so the callback is typed. Never set. */
  readonly __type?: T;
}

export const createContext = <T>(name: string): Context<T> => ({ name });

export class ContextRequestEvent<T> extends Event {
  constructor(
    readonly context: Context<T>,
    readonly callback: (value: T) => void,
  ) {
    super('context-request', { bubbles: true, composed: true });
  }
}

export type ContextProvider = Map<Context<unknown>, unknown>;

/**
 * Answers `context-request` events under `root` from `ports`. Unknown keys are left to
 * bubble further, so nested providers (a preview subtree on fakes, a test harness) can
 * coexist with this one.
 */
export function provideContexts(root: EventTarget, ports: ContextProvider): () => void {
  const listener = (event: Event): void => {
    const request = event as ContextRequestEvent<unknown>;
    if (!ports.has(request.context)) return;
    request.stopPropagation();
    request.callback(ports.get(request.context));
  };
  root.addEventListener('context-request', listener);
  return () => root.removeEventListener('context-request', listener);
}
