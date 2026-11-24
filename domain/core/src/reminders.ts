import type { DayKey, ReminderSettings } from '@hmpt/domain-contract';
import { addDays, dayKeyOf, localInstant } from './days';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTime(time: string): { hours: number; minutes: number } | null {
  const match = TIME.exec(time);
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function reminderInstantOn(day: DayKey, time: string): Date | null {
  const parsed = parseTime(time);
  return parsed ? localInstant(day, parsed.hours, parsed.minutes) : null;
}

/**
 * When the next reminder check should run: today's reminder time while it is still
 * ahead, otherwise tomorrow's. A reader opening the app after the reminder time is
 * already where the reminder would have sent them.
 */
export function nextReminderAt(now: Date, settings: ReminderSettings): Date | null {
  if (!settings.enabled) return null;
  const today = dayKeyOf(now);
  const todays = reminderInstantOn(today, settings.time);
  if (!todays) return null;
  return now < todays ? todays : reminderInstantOn(addDays(today, 1), settings.time);
}
