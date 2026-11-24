import type { FieldError } from '@hmpt/domain-contract';

/** Writes each field's message next to it, clears the others, and flags the inputs. */
export function showFieldErrors(root: HTMLElement, errors: readonly FieldError[]): void {
  for (const slot of root.querySelectorAll<HTMLElement>('[data-error]')) {
    const field = slot.dataset.error ?? '';
    const messages = errors.filter((e) => e.field === field).map((e) => e.message);
    slot.textContent = messages.join(' ');
    const input = root.querySelector(`[name="${field}"]`);
    if (input) input.toggleAttribute('aria-invalid', messages.length > 0);
  }
}
