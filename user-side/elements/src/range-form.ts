import type { PageRange, PageRangePort, ReadingSnapshot } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { showFieldErrors } from './forms';
import { PortBoundElement } from './port-bound';

const MAX_CHIPS = 12;

/** `<hmpt-range-form>` — the minimum, maximum and step the daily page count is drawn from. */
export class RangeForm extends PortBoundElement {
  #range?: PageRangePort;
  #dirty = false;

  protected markup(): string {
    return /* html */ `
      <section class="surface" aria-labelledby="range-title">
        <box-pk padding="var(--s1)">
          <form novalidate>
            <stack-pk space="var(--s0)">
              <div>
                <h2 id="range-title">Daily challenge</h2>
                <p class="muted">Each day's card draws a page count from this range.</p>
              </div>
              <switcher-pk threshold="18rem" space="var(--s-1)" class="range-fields">
                <label class="field"><span>Minimum</span><input name="min" type="number" inputmode="numeric" min="1" max="1000" step="1" required></label>
                <label class="field"><span>Maximum</span><input name="max" type="number" inputmode="numeric" min="1" max="1000" step="1" required></label>
                <label class="field"><span>Step</span><input name="step" type="number" inputmode="numeric" min="1" max="1000" step="1" required></label>
              </switcher-pk>
              <p class="field-error" data-error="min"></p>
              <p class="field-error" data-error="max"></p>
              <p class="field-error" data-error="step"></p>
              <div>
                <p class="eyebrow">Possible cards</p>
                <cluster-pk space="var(--s-2)" class="range-preview" data-preview></cluster-pk>
              </div>
              <cluster-pk space="var(--s0)" align="center">
                <button class="btn btn-primary" type="submit">Save range</button>
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
      showFieldErrors(this, result.ok ? [] : result.error);
      const status = this.$('[data-status]');
      status.dataset.tone = result.ok ? 'ok' : 'warn';
      status.textContent = !result.ok
        ? 'That range does not work yet.'
        : result.value.todayRedrawn
          ? "Saved ✓ — today's card was redrawn to fit."
          : 'Saved ✓ — applies from the next card.';
      if (result.ok) this.#dirty = false;
    });
  }

  protected connect() {
    this.#range = this.request(readingContexts.range);
    const view = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #read(): PageRange {
    const form = this.$<HTMLFormElement>('form');
    const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).valueAsNumber;
    return { min: value('min'), max: value('max'), step: value('step') };
  }

  #preview(): void {
    if (!this.#range) return;
    const result = this.#range.preview(this.#read());
    showFieldErrors(this, result.ok ? [] : result.error);
    const chips: HTMLElement[] = [];
    if (result.ok) {
      const values = result.value;
      const shown = values.length > MAX_CHIPS ? [...values.slice(0, MAX_CHIPS - 2), null, values.at(-1)!] : values;
      for (const value of shown) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = value === null ? `… ${values.length - (MAX_CHIPS - 1)} more` : String(value);
        chips.push(chip);
      }
    }
    this.$('[data-preview]').replaceChildren(...chips);
  }

  #render({ range }: ReadingSnapshot): void {
    if (this.#dirty) return;
    const form = this.$<HTMLFormElement>('form');
    for (const key of ['min', 'max', 'step'] as const) {
      (form.elements.namedItem(key) as HTMLInputElement).value = String(range[key]);
    }
    this.#preview();
  }
}
