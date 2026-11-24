import type { Language, LanguageSetting } from '@hmpt/domain-contract';
import { dateOf } from '../format';
import { en, type Messages } from './en';
import { fr } from './fr';

const CATALOGS: Record<Language, Messages> = { en, fr };

/** The words, and the dates and numbers, of one language and locale. */
export interface Speech {
  readonly language: Language;
  readonly locale: string;
  readonly t: Messages;
  /** 1,234 · 1 234 */
  num(n: number): string;
  /** "Tuesday, 24 November" · "Mardi 24 novembre" — capitalised, it heads a page. */
  longDate(day: string): string;
  /** "24 Nov 2026" */
  shortDate(day: string): string;
  /** "24 Nov" — when the year goes without saying. */
  dayMonth(day: string): string;
  /** "Tue, 24 Nov" */
  dayLabel(day: string): string;
  /** "November" (long) or "Nov" (short), as it reads mid-sentence. */
  month(month: number, style?: 'long' | 'short'): string;
  /** "November 2026" · "Novembre 2026" — a title. */
  monthYear(year: number, month: number): string;
  /** Monday-first one-letter weekday initials. */
  weekdayInitials(): readonly string[];
}

const capitalise = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1);

const safeLocale = (locale: string, language: Language): string => {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0 ? locale : language;
  } catch {
    return language;
  }
};

function build(language: Language, requested: string): Speech {
  const locale = safeLocale(requested, language);
  const numbers = new Intl.NumberFormat(locale);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options);
  const long = format({ weekday: 'long', day: 'numeric', month: 'long' });
  const short = format({ day: 'numeric', month: 'short', year: 'numeric' });
  const dayMonth = format({ day: 'numeric', month: 'short' });
  const dayLabel = format({ weekday: 'short', day: 'numeric', month: 'short' });
  const monthLong = format({ month: 'long' });
  const monthShort = format({ month: 'short' });
  const monthYear = format({ month: 'long', year: 'numeric' });
  const weekday = format({ weekday: 'narrow' });
  return {
    language,
    locale,
    t: CATALOGS[language],
    num: (n) => numbers.format(n),
    longDate: (day) => capitalise(long.format(dateOf(day))),
    shortDate: (day) => short.format(dateOf(day)),
    dayMonth: (day) => dayMonth.format(dateOf(day)),
    dayLabel: (day) => dayLabel.format(dateOf(day)),
    month: (month, style = 'long') => (style === 'long' ? monthLong : monthShort).format(new Date(2000, month - 1, 1)),
    monthYear: (year, month) => capitalise(monthYear.format(new Date(year, month - 1, 1))),
    // 3 January 2000 was a Monday.
    weekdayInitials: () => Array.from({ length: 7 }, (_, i) => weekday.format(new Date(2000, 0, 3 + i)).toLocaleUpperCase()),
  };
}

const spoken = new Map<string, Speech>();

/** The speech for a language setting — built once per language and locale. */
export function speech(setting: Pick<LanguageSetting, 'language' | 'locale'>): Speech {
  const key = `${setting.language}|${setting.locale}`;
  let found = spoken.get(key);
  if (!found) {
    found = build(setting.language, setting.locale);
    spoken.set(key, found);
  }
  return found;
}

/** Before any snapshot exists — and when booting fails — the device's own language. */
export function deviceSpeech(): Speech {
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  const tag = tags.find((t) => /^(en|fr)\b/i.test(t)) ?? 'en';
  const language: Language = tag.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  return speech({ language, locale: tag });
}

/** The language named in that language — the same in every catalog. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', fr: 'Français' };
