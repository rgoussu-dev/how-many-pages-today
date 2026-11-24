import { AVATARS, type FieldError, type ProfilePort, type ReadingSnapshot } from '@hmpt/domain-contract';
import { readingContexts } from './contexts';
import { shortDate } from './format';
import { PortBoundElement } from './port-bound';
import { showFieldErrors } from './forms';

/** `<hmpt-profile-form>` — the reader's offline profile. */
export class ProfileForm extends PortBoundElement {
  #profile?: ProfilePort;
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
                <h2 id="profile-title">Ex libris</h2>
                <p class="muted" data-since>Your reader’s card. It stays on this device — nothing is ever sent anywhere.</p>
              </div>
              <fieldset class="avatar-picker">
                <legend class="field-legend">Avatar</legend>
                <cluster-pk space="var(--s-2)">${avatars}</cluster-pk>
                <p class="field-error" data-error="avatar"></p>
              </fieldset>
              <label class="field"><span>Name</span>
                <input name="displayName" autocomplete="nickname" maxlength="40" required>
                <p class="field-error" data-error="displayName"></p>
              </label>
              <label class="field"><span>Favourite genre</span>
                <input name="favouriteGenre" maxlength="60" placeholder="Science fiction, poetry, crime…">
                <p class="field-error" data-error="favouriteGenre"></p>
              </label>
              <cluster-pk space="var(--s0)" align="center">
                <button class="btn btn-primary" type="submit">Save profile</button>
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
      showFieldErrors(this, errors);
      const status = this.$('[data-status]');
      status.dataset.tone = result.ok ? 'ok' : 'warn';
      status.textContent = result.ok ? 'Saved ✓' : 'Please check the highlighted fields.';
      if (result.ok) this.#dirty = false;
    });
  }

  protected connect() {
    this.#profile = this.request(readingContexts.profile);
    const view = this.request(readingContexts.view);
    return [view.subscribe((snapshot) => this.#render(snapshot))];
  }

  #render({ profile }: ReadingSnapshot): void {
    if (!profile || this.#dirty) return; // never clobber what the reader is typing
    const form = this.$<HTMLFormElement>('form');
    (form.elements.namedItem('displayName') as HTMLInputElement).value = profile.displayName;
    (form.elements.namedItem('favouriteGenre') as HTMLInputElement).value = profile.favouriteGenre;
    for (const radio of form.querySelectorAll<HTMLInputElement>('input[name="avatar"]')) {
      radio.checked = radio.value === profile.avatar;
    }
    this.$('[data-since]').textContent = `Reader since ${shortDate(profile.readerSince)} · stays on this device, never sent anywhere.`;
  }
}
