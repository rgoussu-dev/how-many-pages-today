import type { Language, ReminderNotification } from '@hmpt/domain-contract';

/*
 * The only words the domain says itself: the reminder notification, which the service
 * worker shows while no page is open to word it. Everything else is worded by the UI.
 */

export interface ReminderFacts {
  readonly pages: number;
  readonly streak: number;
  readonly readerName: string | null;
  /** The page the day's reading leads to, when a bookmark is kept. */
  readonly untilPage: number | null;
}

type Wording = {
  readonly title: string;
  readonly reminder: (facts: ReminderFacts) => string;
  readonly test: (pages: number) => string;
};

const pagesEn = (n: number) => `${n} ${n === 1 ? 'page' : 'pages'}`;
// French counts 0 and 1 in the singular.
const pagesFr = (n: number) => `${n} ${n <= 1 ? 'page' : 'pages'}`;

const WORDING: Record<Language, Wording> = {
  en: {
    title: 'How many pages today?',
    reminder: ({ pages, streak, readerName, untilPage }) => {
      const who = readerName ? `${readerName}, today` : 'Today';
      const until = untilPage === null ? '' : `, up to page ${untilPage}`;
      const nudge = streak > 0 ? `Keep your ${streak}-day streak alive 🔥` : 'A fresh card is waiting for you 📖';
      return `${who}'s card: ${pagesEn(pages)}${until}. ${nudge}`;
    },
    test: (pages) => `This is what your reminder will look like. Today's card: ${pagesEn(pages)}.`,
  },
  fr: {
    title: 'Combien de pages aujourd’hui\u202f?',
    reminder: ({ pages, streak, readerName, untilPage }) => {
      const who = readerName ? `${readerName}, votre carte du jour` : 'Votre carte du jour';
      const until = untilPage === null ? '' : `, jusqu’à la page ${untilPage}`;
      const nudge =
        streak > 0 ? `Ne laissez pas filer votre série de ${streak}\u00a0jours 🔥` : 'Une carte toute neuve vous attend 📖';
      return `${who}\u00a0: ${pagesFr(pages)}${until}. ${nudge}`;
    },
    test: (pages) => `Voici à quoi ressemblera votre rappel. Carte du jour\u00a0: ${pagesFr(pages)}.`,
  },
};

export const reminderNotification = (language: Language, facts: ReminderFacts, tag: string): ReminderNotification => ({
  title: WORDING[language].title,
  body: WORDING[language].reminder(facts),
  tag,
});

export const testNotification = (language: Language, pages: number, tag: string): ReminderNotification => ({
  title: WORDING[language].title,
  body: WORDING[language].test(pages),
  tag,
});
