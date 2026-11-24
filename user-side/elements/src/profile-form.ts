import { AVATARS, type FieldError, type ProfilePort, type ReadingSnapshot, type ReadingView } from '@hmpt/domain-contract';
import { deviceSpeech, speech } from './i18n';
import { readingContexts } from './contexts';
import { PortBoundElement } from './port-bound';
import { showFieldErrors } from './forms';

/** `<hmpt-profile-form>` — the reader's offline profile. */
export class ProfileForm extends PortBoundElement {
  #profile?: ProfilePort;
  #view?: ReadingView;
  #dirty = false;

  protected markup(): string {
    const avatars = AVATARS.map(
      (a, i) =>
        `<label class="avatar-option"><input type="radio" name="avatar" value="${a}"${i === 0 ? ' checked' : ''}><span>${a}</span></label>`,
    ).join('');
    return /* html */ `
      <section class="surface" aria-labelledby="profile-title">
        <box-pk padding="var(--s1)">
          <form novalidate>
            <stack-pk space="var(--s0)">
              <div>
                <h2 id="profile-title" data-t="profile.heading"></h2>
                <p class="muted" data-since></p>
              </div>
              <fieldset class="avatar-picker">
                <legend class="field-legend" data-t="profile.avatar"></legend>
                <cluster-pk space="var(--s-2)">${avatars}</cluster-pk>
                <p class="field-error" data-error="avatar"></p>
              </fieldset>
              <label class="field"><span data-t="profile.name"></span>
                <input name="displayName" autocomplete="nickname" maxlength="40" required>
                <p class="field-error" data-error="displayName"></p>
              </label>
              <label class="field"><span data-t="profile.genre"></span>
                <input name="favouriteGenre" maxlength="60" data-t-placeholder="profile.genrePlaceholder">
                <p class="field-error" data-error="favouriteGenre"></p>
              </label>
              <cluster-pk space="var(--s0)" align="center">
                <button class="btn btn-primary" type="submit" data-t="profile.save"></button>
                <p class="status" role="status" data-status></p>
              </cluster-pk>
            </stack-pk>
          </form>
        </box-pk>
      </section>`;
  }

  protected override setup(): void {
    const form = this.$<HTMLFormElement>('form');
    form.addEventListener('input', () => (this.#dirty = true));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#profile) return;
      const data = new FormData(form);
      const text = (name: string) => String(data.get(name) ?? '');
      const result = await this.#profile.save({
        displayName: text('displayName'),
        avatar: text('avatar'),
        favouriteGenre: text('favouriteGenre'),
      });
      const errors: readonly FieldError[] = result.ok ? [] : result.error;
      const { t } = this.#words();
      showFieldErrors(this, errors, t);
      const status = this.$('[data-status]');
      status.dataset.tone = result.ok ? 'ok' : 'warn';
      status.textContent = result.ok ? t.common.saved : t.profile.check;
      if (result.ok) this.#dirty = false;
    });
  }

  protected connect() {
    this.#profile = this.request(readingContexts.profile);
    this.#view = this.request(readingContexts.view);
    return [this.#view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #words() {
    const language = this.#view?.current()?.language;
    return language ? speech(language) : deviceSpeech();
  }

  #render({ profile, language }: ReadingSnapshot): void {
    const words = this.speak(language);
    this.$('[data-since]').textContent = profile ? words.t.profile.since(words.shortDate(profile.readerSince)) : words.t.profile.intro;
    if (!profile || this.#dirty) return; // never clobber what the reader is typing
    const form = this.$<HTMLFormElement>('form');
    (form.elements.namedItem('displayName') as HTMLInputElement).value = profile.displayName;
    (form.elements.namedItem('favouriteGenre') as HTMLInputElement).value = profile.favouriteGenre;
    for (const radio of form.querySelectorAll<HTMLInputElement>('input[name="avatar"]')) {
      radio.checked = radio.value === profile.avatar;
    }
  }
}
