import { err, ok, type Result } from '@hmpt/kernel';
import { BOOK_PAGE_LIMITS, type FieldError, type ProfileInput } from '@hmpt/domain-contract';

const LIMITS = { displayName: 40, avatar: 16, favouriteGenre: 60 } as const;
export const TITLE_LIMIT = 120;

export function validateProfile(input: ProfileInput): Result<ProfileInput, FieldError[]> {
  const cleaned: ProfileInput = {
    displayName: input.displayName.trim(),
    avatar: input.avatar.trim(),
    favouriteGenre: input.favouriteGenre.trim(),
  };
  const errors: FieldError[] = [];
  if (cleaned.displayName.length === 0) errors.push({ field: 'displayName', problem: 'required' });
  if (cleaned.avatar.length === 0) errors.push({ field: 'avatar', problem: 'required' });
  for (const field of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (cleaned[field].length > LIMITS[field]) errors.push({ field, problem: 'too-long', max: LIMITS[field] });
  }
  return errors.length === 0 ? ok(cleaned) : err(errors);
}

export function validateTitle(title: string): Result<string, FieldError[]> {
  const cleaned = title.trim().replace(/\s+/g, ' ');
  if (cleaned.length === 0) return err([{ field: 'title', problem: 'required' }]);
  if (cleaned.length > TITLE_LIMIT) return err([{ field: 'title', problem: 'too-long', max: TITLE_LIMIT }]);
  return ok(cleaned);
}

/** A title the reader may leave blank: blank is null, anything else must be a valid title. */
export function validateOptionalTitle(title: string | undefined): Result<string | null, FieldError[]> {
  if (title === undefined || title.trim().length === 0) return ok(null);
  return validateTitle(title);
}

/** A page of a book — where a bookmark sits (0: not yet begun), or how many pages it has (from 1). */
export function validateBookPage(page: number, field: 'bookmark' | 'totalPages'): Result<number, FieldError[]> {
  const lowest = field === 'bookmark' ? 0 : 1;
  const { highest } = BOOK_PAGE_LIMITS;
  if (!Number.isInteger(page)) return err([{ field, problem: 'not-whole' }]);
  if (page < lowest || page > highest) return err([{ field, problem: 'out-of-range', min: lowest, max: highest }]);
  return ok(page);
}
