import { LANGUAGES, type LanguageChoice, type LanguagePort, type ReadingSnapshot } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { LANGUAGE_NAMES, deviceSpeech } from './i18n';
import { PortBoundElement } from './port-bound';

/**
 * `<hmpt-language-form>` — the language the reading room speaks: the device's own (the
 * default), or one the reader picks. Takes effect at once; every element re-words itself.
 */
export class LanguageForm extends PortBoundElement {
  #language?: LanguagePort;

  protected markup(): string {
    // Each language is named in itself, so a reader lost in the wrong one can find theirs.
    const named = LANGUAGES.map(
      (code) =>
        `<label class="choice"><input type="radio" name="language" value="${code}"><span lang="${code}">${LANGUAGE_NAMES[code]}</span></label>`,
    ).join('');
    return /* html */ `
      <section class="surface" aria-labelledby="language-title">
        <box-pk padding="var(--s1)">
          <form novalidate>
            <stack-pk space="var(--s0)">
              <div>
                <h2 id="language-title" data-t="language.heading"></h2>
                <p class="muted" data-t="language.intro"></p>
              </div>
              <fieldset class="choices">
                <legend class="field-legend visually-hidden" data-t="language.legend"></legend>
                <label class="choice"><input type="radio" name="language" value="auto"><span data-auto></span></label>
                ${named}
              </fieldset>
            </stack-pk>
          </form>
        </box-pk>
      </section>`;
  }

  protected override setup(): void {
    this.$('form').addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (input.name === 'language') void this.#language?.choose(input.value as LanguageChoice);
    });
  }

  protected connect() {
    this.#language = this.request(readingContexts.language);
    const view = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #render({ language }: ReadingSnapshot): void {
    const { t } = this.speak(language);
    // "Automatic" names what the device would pick — which is not the picked language when one is chosen.
    const device = language.choice === 'auto' ? language.language : deviceSpeech().language;
    this.$('[data-auto]').textContent = t.language.auto(LANGUAGE_NAMES[device]);
    for (const radio of this.querySelectorAll<HTMLInputElement>('input[name="language"]')) {
      radio.checked = radio.value === language.choice;
    }
  }
}
