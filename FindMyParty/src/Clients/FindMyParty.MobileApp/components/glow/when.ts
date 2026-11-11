// Dates and times on the Glow screens, in the phone's local time. Pure, tested in services/__tests__/perkRows.test.mjs.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const two = (n: number) => String(n).padStart(2, '0');

/** "Fri 6 Nov" for a night's date as the server writes it (`YYYY-MM-DD`, the night's date in the city). */
export function nightLabel(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  // Built from its parts, so the date does not move across midnight with the phone's time zone.
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

/** "23:00" in local time, from an ISO date. Empty when it cannot be read. */
export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${two(date.getHours())}:${two(date.getMinutes())}`;
}

/**
 * Until when a claim code is good: "Good until 03:00" on the same night, "Good until Sat 7 Nov, 03:00" later.
 * Null when it cannot be read.
 */
export function goodUntil(expiresAt: string | null | undefined, now: Date): string | null {
  if (!expiresAt) return null;
  const until = new Date(expiresAt);
  if (Number.isNaN(until.getTime())) return null;
  const time = clockTime(expiresAt);
  // A code that runs out before 06:00 tomorrow is still tonight's.
  const endOfTonight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 6);
  if (until.getTime() <= endOfTonight.getTime()) return `Good until ${time}`;
  return `Good until ${WEEKDAYS[until.getDay()]} ${until.getDate()} ${MONTHS[until.getMonth()]}, ${time}`;
}
