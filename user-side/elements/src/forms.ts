import type { FieldError } from '@hmpt/domain-contract';
import type { Messages } from './i18n';

/** Words each field's problems next to it, clears the others, and flags the inputs. */
export function showFieldErrors(root: HTMLElement, errors: readonly FieldError[], t: Messages): void {
  for (const slot of root.querySelectorAll<HTMLElement>('[data-error]')) {
    const field = slot.dataset.error ?? '';
    const messages = errors.filter((e) => e.field === field).map((e) => t.common.fieldError(e));
    slot.textContent = messages.join(' ');
    const input = root.querySelector(`[name="${field}"]`);
    if (input) input.toggleAttribute('aria-invalid', messages.length > 0);
  }
}

/** A number typed in a field, or undefined when it was left blank. */
export const typedNumber = (input: HTMLInputElement): number | undefined =>
  input.value.trim() === '' ? undefined : input.valueAsNumber;
