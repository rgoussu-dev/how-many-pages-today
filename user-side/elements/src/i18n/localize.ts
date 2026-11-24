import type { Messages } from './en';

/*
 * The static words of a template are marked, not written: `data-t="card.logButton"` takes
 * its text from the phrasebook, and `data-t-placeholder`, `data-t-label` (aria-label) and
 * `data-t-title` its attributes. Re-run whenever the language changes; it touches nothing else.
 */

const ATTRIBUTES = [
  ['tPlaceholder', 'placeholder'],
  ['tLabel', 'aria-label'],
  ['tTitle', 'title'],
] as const;

export function phrase(t: Messages, path: string): string {
  let value: unknown = t;
  for (const key of path.split('.')) value = (value as Record<string, unknown> | undefined)?.[key];
  if (typeof value === 'string') return value;
  console.error(`No phrase at "${path}"`);
  return path;
}

/** The marked nodes under `root` — and `root` itself, when it is marked. */
const marked = (root: ParentNode, selector: string): HTMLElement[] => [
  ...(root instanceof HTMLElement && root.matches(selector) ? [root] : []),
  ...root.querySelectorAll<HTMLElement>(selector),
];

export function localize(root: ParentNode, t: Messages): void {
  for (const node of marked(root, '[data-t]')) node.textContent = phrase(t, node.dataset.t ?? '');
  for (const [key, attribute] of ATTRIBUTES) {
    const selector = `[data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`;
    for (const node of marked(root, selector)) node.setAttribute(attribute, phrase(t, node.dataset[key] ?? ''));
  }
}
