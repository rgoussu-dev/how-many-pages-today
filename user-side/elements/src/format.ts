/** Presentation helpers. Calendar maths is duplicated from the domain on purpose: the
 *  elements may not import the core, and a few lines of date code are cheaper than a seam. */

const pad = (n: number) => String(n).padStart(2, '0');

export const dateOf = (day: string): Date => {
  const [y = 1970, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const dayKeyOf = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const addDays = (day: string, count: number): string => {
  const date = dateOf(day);
  date.setDate(date.getDate() + count);
  return dayKeyOf(date);
};

export const longDate = (day: string): string =>
  new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(dateOf(day));

export const shortDate = (day: string): string =>
  new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(dateOf(day));

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;
