// Words and numbers on the Pass: day, time, money, and the split into coming up and earlier.
// Pure, no React. Times are shown in the phone's local time, 24-hour.
import type { Booking, Pass } from '@/types/api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DAY_MS = 86_400_000;

const two = (n: number) => String(n).padStart(2, '0');
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "23:00" */
export function clock(date: Date): string {
  return `${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** "Fri 6 Nov" */
export function shortDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * "Tonight", "Tomorrow", or weekday and date. A party that has already started, or that starts
 * in the small hours after this evening, still counts as tonight.
 */
export function dayWord(date: Date, nowMs: number): string {
  const now = new Date(nowMs);
  const days = Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);
  if (days <= 0) return 'Tonight';
  if (days === 1) return date.getHours() < 6 && now.getHours() >= 12 ? 'Tonight' : 'Tomorrow';
  return shortDate(date);
}

/** "Tonight, doors 23:00". Empty when the time is unknown. */
export function doorsLine(startsAt: string | null | undefined, nowMs: number): string {
  if (!startsAt) return '';
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return '';
  return `${dayWord(date, nowMs)}, doors ${clock(date)}`;
}

/** "€5", "€7.50", "Free" */
export function money(amount: number): string {
  if (!(amount > 0)) return 'Free';
  return Number.isInteger(amount) ? `€${amount}` : `€${amount.toFixed(2)}`;
}

/** What follows "Admit 2": "€10 at the door" or "free entry". */
export function priceAtDoor(totalPrice: number): string {
  return totalPrice > 0 ? `${money(totalPrice)} at the door` : 'free entry';
}

/** "0:24" */
export function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${two(seconds % 60)}`;
}

/** A theme colour (`#RRGGBB`) at an opacity, for gradient stops and soft ink. */
export function alpha(hex: string, opacity: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${opacity})`;
}

/** One page of the pager. `booking` is null when only the copy saved on the phone is known (no signal). */
export type TicketEntry = {
  bookingId: string;
  booking: Booking | null;
};

const time = (iso: string | null | undefined) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? 0 : ms;
};

/** Coming up = not cancelled and the party has not ended, soonest first. Earlier = the rest, latest first. */
export function splitBookings(bookings: readonly Booking[], nowMs: number): { upcoming: TicketEntry[]; past: Booking[] } {
  const upcoming: Booking[] = [];
  const past: Booking[] = [];
  for (const booking of bookings) {
    if (booking.status !== 'Cancelled' && time(booking.partyEndsAt) > nowMs) upcoming.push(booking);
    else past.push(booking);
  }
  const starts = (b: Booking) => time(b.party?.startsAt ?? b.partyEndsAt);
  upcoming.sort((a, b) => starts(a) - starts(b));
  past.sort((a, b) => time(b.partyEndsAt) - time(a.partyEndsAt));
  return { upcoming: upcoming.map((booking) => ({ bookingId: booking.id, booking })), past };
}

/** The same rule for passes saved on the phone, used when the bookings cannot be loaded. */
export function savedUpcoming(passes: readonly Pass[], nowMs: number): TicketEntry[] {
  return passes
    .filter((pass) => pass.status !== 'Cancelled' && time(pass.endsAt) > nowMs)
    .sort((a, b) => time(a.startsAt) - time(b.startsAt))
    .map((pass) => ({ bookingId: pass.bookingId, booking: null }));
}

/** What became of an earlier booking, in words. */
export function pastStatus(booking: Booking): string {
  if (booking.status === 'Cancelled') return 'Cancelled';
  if (booking.checkedInCount > 0) return `${booking.checkedInCount} went in`;
  return 'Not used';
}
