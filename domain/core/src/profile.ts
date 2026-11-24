import { err, ok, type Result } from '@hmpt/kernel';
import type { FieldError, ProfileInput } from '@hmpt/domain-contract';

const LIMITS = { displayName: 40, avatar: 16, favouriteGenre: 60 } as const;
export const TITLE_LIMIT = 120;

export function validateProfile(input: ProfileInput): Result<ProfileInput, FieldError[]> {
  const cleaned: ProfileInput = {
    displayName: input.displayName.trim(),
    avatar: input.avatar.trim(),
    favouriteGenre: input.favouriteGenre.trim(),
  };
  const errors: FieldError[] = [];
  if (cleaned.displayName.length === 0) errors.push({ field: 'displayName', message: 'Tell us what to call you.' });
  if (cleaned.avatar.length === 0) errors.push({ field: 'avatar', message: 'Pick an avatar.' });
  for (const field of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (cleaned[field].length > LIMITS[field])
      errors.push({ field, message: `Keep it under ${LIMITS[field]} characters.` });
  }
  return errors.length === 0 ? ok(cleaned) : err(errors);
}

export function validateTitle(title: string): Result<string, FieldError[]> {
  const cleaned = title.trim().replace(/\s+/g, ' ');
  if (cleaned.length === 0) return err([{ field: 'title', message: 'Which book is it?' }]);
  if (cleaned.length > TITLE_LIMIT) return err([{ field: 'title', message: `Keep it under ${TITLE_LIMIT} characters.` }]);
  return ok(cleaned);
}
