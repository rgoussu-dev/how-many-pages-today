import type { Clock, LanguageSource, RandomSource } from '@hmpt/kernel';

export const systemClock: Clock = { now: () => new Date() };

export const mathRandom: RandomSource = { next: () => Math.random() };

/** `navigator.languages` — in a page and in a service worker alike. Compiles without the DOM. */
export const deviceLanguages: LanguageSource = {
  preferred: () => {
    const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } }).navigator;
    if (nav?.languages && nav.languages.length > 0) return nav.languages;
    return nav?.language ? [nav.language] : [];
  },
};
