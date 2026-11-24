import { LANGUAGES, type Language, type LanguageChoice, type LanguageSetting } from '@hmpt/domain-contract';

const FALLBACK: Language = 'en';

const isLanguage = (value: string): value is Language => (LANGUAGES as readonly string[]).includes(value);

const baseOf = (tag: string): string => tag.toLowerCase().split(/[-_]/)[0] ?? '';

export const isLanguageChoice = (value: string): value is LanguageChoice => value === 'auto' || isLanguage(value);

/**
 * The language the app speaks: the reader's pick, or else the first of the device's
 * languages the app knows — English when none is. The locale keeps the device's own
 * regional variant of that language (`fr-CA` dates for a Québécois reader), when it has one.
 */
export function resolveLanguage(choice: LanguageChoice, device: readonly string[]): LanguageSetting {
  const language =
    choice !== 'auto' ? choice : (device.map(baseOf).find((base): base is Language => isLanguage(base)) ?? FALLBACK);
  const locale = device.find((tag) => baseOf(tag) === language) ?? language;
  return { choice, language, locale };
}
