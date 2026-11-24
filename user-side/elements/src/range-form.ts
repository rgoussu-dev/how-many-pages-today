import type { PageRange, PageRangePort, ReadingSnapshot, ReadingView } from '@hmpt/domain-contract';
import { deviceSpeech, speech } from './i18n';
import { readingContexts } from './contexts';
import { showFieldErrors } from './forms';
import { PortBoundElement } from './port-bound';

const MAX_CHIPS = 12;

/** `<hmpt-range-form>` — the minimum, maximum and step the daily page count is drawn from. */
export class RangeForm extends PortBoundElement {
  #range?: PageRangePort;
  #view?: ReadingView;
  #dirty = false;

  protected markup(): string {
    return /* html */ `
      <section class="surface" aria-labelledby="range-title">
        <box-pk padding="var(--s1)">
          <form novalidate>
            <stack-pk space="var(--s0)">
              <div>
                <h2 id="range-title" data-t="range.heading"></h2>
                <p class="muted" data-t="range.intro"></p>
              </div>
              <switcher-pk threshold="18rem" space="var(--s-1)" class="range-fields">
                <label class="field"><span data-t="range.min"></span><input name="min" type="number" inputmode="numeric" min="1" max="1000" step="1" required></label>
                <label class="field"><span data-t="range.max"></span><input name="max" type="number" inputmode="numeric" min="1" max="1000" step="1" required></label>
                <label class="field"><span data-t="range.step"></span><input name="step" type="number" inputmode="numeric" min="1" max="1000" step="1" required></label>
              </switcher-pk>
              <p class="field-error" data-error="min"></p>
              <p class="field-error" data-error="max"></p>
              <p class="field-error" data-error="step"></p>
              <div>
                <p class="eyebrow" data-t="range.possible"></p>
                <cluster-pk space="var(--s-2)" class="range-preview" data-preview></cluster-pk>
              </div>
              <cluster-pk space="var(--s0)" align="center">
                <button class="btn btn-primary" type="submit" data-t="range.save"></button>
                <p class="status" role="status" data-status></p>
              </cluster-pk>
            </stack-pk>
          </form>
        </box-pk>
      </section>`;
  }

  protected override setup(): void {
    const form = this.$<HTMLFormElement>('form');
    form.addEventListener('input', () => {
      this.#dirty = true;
      this.$('[data-status]').textContent = '';
      this.#preview();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#range) return;
      const result = await this.#range.update(this.#read());
      const { t } = this.#words();
      showFieldErrors(this, result.ok ? [] : result.error, t);
      const status = this.$('[data-status]');
      status.dataset.tone = result.ok ? 'ok' : 'warn';
      status.textContent = !result.ok ? t.range.invalid : result.value.todayRedrawn ? t.range.redrawn : t.range.fromNext;
      if (result.ok) this.#dirty = false;
    });
  }

  protected connect() {
    this.#range = this.request(readingContexts.range);
    this.#view = this.request(readingContexts.view);
    return [this.#view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #words() {
    const language = this.#view?.current()?.language;
    return language ? speech(language) : deviceSpeech();
  }

  #read(): PageRange {
    const form = this.$<HTMLFormElement>('form');
    const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).valueAsNumber;
    return { min: value('min'), max: value('max'), step: value('step') };
  }

  #preview(): void {
    if (!this.#range) return;
    const result = this.#range.preview(this.#read());
    const words = this.#words();
    showFieldErrors(this, result.ok ? [] : result.error, words.t);
    const chips: HTMLElement[] = [];
    if (result.ok) {
      const values = result.value;
      const shown = values.length > MAX_CHIPS ? [...values.slice(0, MAX_CHIPS - 2), null, values.at(-1)!] : values;
      for (const value of shown) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = value === null ? words.t.range.more(values.length - (MAX_CHIPS - 1)) : words.num(value);
        chips.push(chip);
      }
    }
    this.$('[data-preview]').replaceChildren(...chips);
  }

  #render({ range, language }: ReadingSnapshot): void {
    this.speak(language);
    if (this.#dirty) return this.#preview(); // re-word the preview, keep what is typed
    const form = this.$<HTMLFormElement>('form');
    for (const key of ['min', 'max', 'step'] as const) {
      (form.elements.namedItem(key) as HTMLInputElement).value = String(range[key]);
    }
    this.#preview();
  }
}
