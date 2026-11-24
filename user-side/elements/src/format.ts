/** Calendar helpers. Calendar maths is duplicated from the domain on purpose: the elements
 *  may not import the core, and a few lines of date code are cheaper than a seam. Words,
 *  dates and numbers as the reader reads them live in `./i18n`. */

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
