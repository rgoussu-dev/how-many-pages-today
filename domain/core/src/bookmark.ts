import { err, ok, type Result } from '@hmpt/kernel';
import { BOOK_PAGE_LIMITS, PAGES_READ_LIMITS, type BookInHand, type ChallengeError } from '@hmpt/domain-contract';

/** A bookmark never goes past the last page, when the book's length is known. */
const capped = (book: BookInHand, page: number): number =>
  book.totalPages === undefined ? page : Math.min(page, book.totalPages);

/**
 * The page the day's reading leads to: the bookmark plus the day's goal, stopping at the
 * book's last page. Null without a book in hand or a bookmark in it.
 */
export function readTo(book: BookInHand | null, pages: number): number | null {
  if (!book || book.bookmark === undefined) return null;
  return capped(book, book.bookmark + pages);
}

/** The pages read from the bookmark to the page the reader stopped at — if that page can be. */
export function pagesTo(book: BookInHand, stoppedAt: number): Result<number, ChallengeError> {
  if (book.bookmark === undefined) return err('no-bookmark');
  if (!Number.isInteger(stoppedAt)) return err('invalid-page');
  if (stoppedAt <= book.bookmark) return err('not-past-bookmark');
  if (stoppedAt > (book.totalPages ?? BOOK_PAGE_LIMITS.highest)) return err('past-the-end');
  const pages = stoppedAt - book.bookmark;
  return pages > PAGES_READ_LIMITS.highest ? err('too-many-pages') : ok(pages);
}

/** The reader stopped on the book's last page. */
export const isLastPage = (book: BookInHand, stoppedAt: number): boolean => book.totalPages === stoppedAt;
