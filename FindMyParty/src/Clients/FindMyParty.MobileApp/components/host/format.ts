// How the host screens write times and money. Local time, 24-hour; euros, no trailing ".00".

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DAY_MS = 24 * 60 * 60_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toDate(value: string | number | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "23:00" in the phone's time. Empty when the value is not a date. */
export function clock(value: string | number | Date): string {
  const d = toDate(value);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}

/** "Tonight", "Tomorrow", "Fri" within the week, otherwise "Fri 13 Nov". */
export function dayWord(value: string | number | Date, now: number = Date.now()): string {
  const d = toDate(value);
  if (!d) return '';
  const days = Math.round((startOfDay(d) - startOfDay(new Date(now))) / DAY_MS);
  if (days === 0) return 'Tonight';
  if (days === 1) return 'Tomorrow';
  if (days > 1 && days < 7) return WEEKDAYS[d.getDay()];
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Fri 13": the short date for a chooser. */
export function shortDate(value: string | number | Date): string {
  const d = toDate(value);
  return d ? `${WEEKDAYS[d.getDay()]} ${d.getDate()}` : '';
}

/** "Tonight 23:00", "Fri 23:00". */
export function dayAndTime(value: string | number | Date, now: number = Date.now()): string {
  return `${dayWord(value, now)} ${clock(value)}`.trim();
}

/** "23:00 to 03:00", tolerating a missing end. */
export function timeRange(startsAt: string, endsAt: string): string {
  const start = clock(startsAt);
  const end = clock(endsAt);
  if (start && end) return `${start} to ${end}`;
  return start || end;
}

/** "€5", "€7.50", "€1,280". Zero is "€0": use `price` where zero should read "Free". */
export function euros(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const fixed = Number.isInteger(safe) ? String(safe) : safe.toFixed(2);
  const [whole, cents] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `€${cents ? `${grouped}.${cents}` : grouped}`;
}

/** A price a guest pays: "Free" for zero, otherwise euros. */
export function price(amount: number): string {
  return amount > 0 ? euros(amount) : 'Free';
}
