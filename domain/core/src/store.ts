import type { ReadingEvent, ReadingSnapshot, ReadingView } from '@hmpt/domain-contract';

/** The read model: the latest snapshot plus two subscription lists. */
export class ReadingStore implements ReadingView {
  #snapshot: ReadingSnapshot | null = null;
  readonly #listeners = new Set<(snapshot: ReadingSnapshot) => void>();
  readonly #eventListeners = new Set<(event: ReadingEvent) => void>();

  current(): ReadingSnapshot | null {
    return this.#snapshot;
  }

  subscribe(listener: (snapshot: ReadingSnapshot) => void): () => void {
    this.#listeners.add(listener);
    if (this.#snapshot) listener(this.#snapshot);
    return () => this.#listeners.delete(listener);
  }

  onEvent(listener: (event: ReadingEvent) => void): () => void {
    this.#eventListeners.add(listener);
    return () => this.#eventListeners.delete(listener);
  }

  publish(snapshot: ReadingSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener(snapshot);
  }

  emit(event: ReadingEvent): void {
    for (const listener of this.#eventListeners) listener(event);
  }
}
