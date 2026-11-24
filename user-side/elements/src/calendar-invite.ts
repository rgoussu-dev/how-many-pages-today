/*
 * A daily recurring calendar event with an alarm — the one reminder that rings reliably on
 * every phone, because the phone's own calendar rings it. Built entirely offline.
 * RFC 5545; floating local time (no TZID) so it rings at the same wall-clock hour wherever
 * the reader is.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const floating = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const escapeText = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export function dailyReminderInvite(time: string, appUrl: string, now: Date = new Date()): string {
  const [hours = 20, minutes = 0] = time.split(':').map(Number);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  if (start <= now) start.setDate(start.getDate() + 1);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//How Many Pages Today//Daily reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:daily-reading-${now.getTime()}@how-many-pages-today`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${floating(start)}`,
    'DURATION:PT15M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escapeText('📖 How many pages today?')}`,
    `DESCRIPTION:${escapeText(`Your reading card is waiting: ${appUrl}`)}`,
    `URL:${appUrl}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText('Time for your daily pages')}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}
