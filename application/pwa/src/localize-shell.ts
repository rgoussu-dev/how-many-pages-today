import type { ReadingView } from '@hmpt/domain-contract';
import { localize, speech, type Speech } from '@hmpt/elements';
import type { Router } from './router';

/**
 * The shell speaks the reader's language too: its marked words (`data-t…` in index.html),
 * the document's `lang`, and the document title. The elements word themselves, from the
 * same phrasebook — so passing over their marked words as well changes nothing.
 */
export function localizeShell(view: ReadingView, router: Router, root: ParentNode = document): void {
  let spoken: Speech | null = null;
  view.subscribe(({ language }) => {
    const words = speech(language);
    if (words === spoken) return;
    spoken = words;
    document.documentElement.lang = words.locale;
    const app = root.querySelector<HTMLElement>('.app');
    if (app) localize(app, words.t);
    router.retitle();
  });
}
