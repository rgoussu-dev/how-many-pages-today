import type { BookInHand } from '@hmpt/domain-contract';

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

/** The bookmark moved on by the pages just read. A book without a bookmark stays as it is. */
export function advance(book: BookInHand, pages: number): BookInHand {
  if (book.bookmark === undefined) return book;
  return { ...book, bookmark: capped(book, book.bookmark + pages) };
}
