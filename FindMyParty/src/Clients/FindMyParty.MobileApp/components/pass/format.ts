// Words and numbers on the Pass: day, time, money, and the split into coming up and earlier.
// Pure, no React. Times are shown in the phone's local time, 24-hour.
import type { Booking, GuestPass, Pass } from '@/types/api';

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
export function priceAtDoor(amountDue: number): string {
  return amountDue > 0 ? `${money(amountDue)} at the door` : 'free entry';
}

/** "Monkey, Stara Varoš". Empty when the venue is unknown. */
export function venueLine(venueName: string | null | undefined, venueArea: string | null | undefined): string {
  return [venueName, venueArea].filter((part) => !!part && part.trim()).join(', ');
}

/** "Guest of Vule", on a pass someone gave you. Null on your own pass. */
export function guestOfLine(guestOf: string | null | undefined): string | null {
  return guestOf && guestOf.trim() ? `Guest of ${guestOf.trim()}` : null;
}

/**
 * The bottom right of the ticket: `lead` in bold, then `rest`. "**Admit 2**, €5 at the door",
 * "**Admit 2**, free entry", and once the code lets nobody else in, "**All in**".
 */
export function admitLine(admit: number, amountDue: number): { lead: string; rest: string | null } {
  if (!(admit > 0)) return { lead: 'All in', rest: null };
  return { lead: `Admit ${admit}`, rest: priceAtDoor(amountDue) };
}

/**
 * What the booking's own code still lets in, worked out from the booking when the pass has not
 * loaded yet (the server's `Pass.admit` wins once it has): spots, less the guest passes handed out,
 * less those already let in on the main code.
 */
export function admitFromBooking(booking: Booking): number {
  if (booking.guestPassId) return Math.max(0, booking.ticketCount - booking.checkedInCount);
  return Math.max(0, booking.ticketCount - booking.guestPasses.length - mainAdmitted(booking));
}

/** Guests let in on the booker's own code: every scan on the booking, less the guest passes already in. */
function mainAdmitted(booking: Booking): number {
  const guestsIn = booking.guestPasses.filter((pass) => pass.status === 'in').length;
  return Math.max(0, booking.checkedInCount - guestsIn);
}

/** Bookings that can still be used at the door. */
const live = (status: Booking['status']) => status === 'Pending' || status === 'Confirmed';

/**
 * True when the booker may turn one more spot into a guest link (BUILD-3-SPEC §2.3): the main code
 * must keep one spot for the booker, unless the booker is already inside.
 */
export function canGiveSpot(booking: Booking): boolean {
  if (booking.guestPassId || !live(booking.status)) return false;
  const admitted = mainAdmitted(booking);
  const admit = booking.ticketCount - booking.guestPasses.length - admitted;
  return admit >= 2 || (admit >= 1 && admitted > 0);
}

/** "Send to a guest" shows while a spot can be given, or while there are links to share or take back. */
export function showSendToGuest(booking: Booking | null): boolean {
  if (!booking || booking.guestPassId || !live(booking.status)) return false;
  return canGiveSpot(booking) || booking.guestPasses.length > 0;
}

/** Where a guest link stands, in words: "Not taken yet", "Taken by Mila", "Mila is in". */
export function guestPassState(pass: Pick<GuestPass, 'status' | 'guestName'>): string {
  const name = pass.guestName?.trim() || null;
  if (pass.status === 'in') return name ? `${name} is in` : 'Your guest is in';
  if (pass.status === 'claimed') return name ? `Taken by ${name}` : 'Taken';
  return 'Not taken yet';
}

/** The cancel link under the buttons: the booker cancels while nobody is in; a guest gives theirs back. */
export function cancelLabel(booking: Booking | null): string | null {
  if (!booking || !live(booking.status) || booking.checkedInCount > 0) return null;
  return booking.guestPassId ? 'Give this pass back' : 'Cancel this pass';
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
  /** `Booking.id`, which for a pass someone gave you is the guest pass id. */
  bookingId: string;
  booking: Booking | null;
  /** A pass someone gave you: its code comes from `/api/guest-passes/{id}/pass`. */
  guest: boolean;
};

const time = (iso: string | null | undefined) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Coming up = still usable (not cancelled, hold not expired) and the party has not ended, soonest first.
 * Earlier = the rest, latest first.
 */
export function splitBookings(bookings: readonly Booking[], nowMs: number): { upcoming: TicketEntry[]; past: Booking[] } {
  const upcoming: Booking[] = [];
  const past: Booking[] = [];
  for (const booking of bookings) {
    if (live(booking.status) && time(booking.partyEndsAt) > nowMs) upcoming.push(booking);
    else past.push(booking);
  }
  const starts = (b: Booking) => time(b.party?.startsAt ?? b.partyEndsAt);
  upcoming.sort((a, b) => starts(a) - starts(b));
  past.sort((a, b) => time(b.partyEndsAt) - time(a.partyEndsAt));
  return {
    upcoming: upcoming.map((booking) => ({ bookingId: booking.id, booking, guest: !!booking.guestPassId })),
    past,
  };
}

/** The same rule for passes saved on the phone, used when the bookings cannot be loaded. */
export function savedUpcoming(passes: readonly Pass[], nowMs: number): TicketEntry[] {
  return passes
    .filter((pass) => live(pass.status) && time(pass.endsAt) > nowMs)
    .sort((a, b) => time(a.startsAt) - time(b.startsAt))
    .map((pass) => ({ bookingId: pass.bookingId, booking: null, guest: pass.kind === 'guest' }));
}

/** What became of an earlier booking, in words. */
export function pastStatus(booking: Booking): string {
  if (booking.status === 'Cancelled') return booking.guestPassId ? 'Given back' : 'Cancelled';
  if (booking.checkedInCount > 0) return `${booking.checkedInCount} went in`;
  if (booking.status === 'Expired') return 'Expired';
  return 'Not used';
}

/**
 * The sentence in place of the door code when the code is no use any more. Null while it still works.
 * `heldUntil` is the local "00:30" the hold ran out.
 */
export function deadPassLine(status: Booking['status'], guest: boolean, heldUntil: string | null | undefined): string | null {
  if (status === 'Cancelled') return guest ? 'This pass was taken back.' : 'This booking was cancelled.';
  if (status === 'Expired') {
    const at = heldUntil ? new Date(heldUntil) : null;
    return at && !Number.isNaN(at.getTime())
      ? `This pass was held until ${clock(at)}. The spot went back to the door.`
      : 'This pass was not scanned in time. The spot went back to the door.';
  }
  return null;
}
