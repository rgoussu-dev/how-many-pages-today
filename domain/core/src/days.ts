import type { DayKey } from '@hmpt/domain-contract';

const DAY_MS = 86_400_000;
const pad = (n: number): string => String(n).padStart(2, '0');

/** The reader's local calendar day for an instant. */
export const dayKeyOf = (instant: Date): DayKey =>
  `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;

const partsOf = (day: DayKey): [number, number, number] => {
  const [y, m, d] = day.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) throw new Error(`Not a day key: ${day}`);
  return [y, m, d];
};

/** Calendar arithmetic on day keys, done in UTC so DST shifts never skip or repeat a day. */
const utcOf = (day: DayKey): number => {
  const [y, m, d] = partsOf(day);
  return Date.UTC(y, m - 1, d);
};

export const addDays = (day: DayKey, count: number): DayKey => {
  const t = new Date(utcOf(day) + count * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

export const daysBetween = (from: DayKey, to: DayKey): number => Math.round((utcOf(to) - utcOf(from)) / DAY_MS);

/** 0 = Sunday … 6 = Saturday. */
export const weekdayOf = (day: DayKey): number => new Date(utcOf(day)).getUTCDay();

/** The local instant at `hours:minutes` on `day`. */
export const localInstant = (day: DayKey, hours: number, minutes: number): Date => {
  const [y, m, d] = partsOf(day);
  return new Date(y, m - 1, d, hours, minutes, 0, 0);
};
