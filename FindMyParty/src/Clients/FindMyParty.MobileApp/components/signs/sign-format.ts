// What the sign screens say about formats, spots, prices and bookings (S-20 and the admin's review).
// Pure: no React, no `@/` imports (tested in services/__tests__/signFormat.test.mjs).

import type { SignBooking, SignFormat, SignFormatInfo, SignSpot, SignWeek } from '../../types/api.ts';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
/** A night runs until 06:00: a party at 01:00 on Saturday belongs to Friday night. */
const NIGHT_ENDS_HOUR = 6;

/** "€40", "€7.50"; "Free" for nothing. */
export function euros(amount: number): string {
  if (!amount) return 'Free';
  return Number.isInteger(amount) ? `€${amount}` : `€${amount.toFixed(2)}`;
}

/** "this week", "next week", or the week's own label ("17–23 Nov") further ahead. */
export function weekPhrase(week: Pick<SignWeek, 'label'>): string {
  const label = week.label.trim();
  if (label === 'This week' || label === 'Next week') return label.toLowerCase();
  return label;
}

/** The second line of a format row: "3 of 8 spots free this week", "1 of 2 free", "Per night" or "Full tonight". */
export function formatSubtitle(info: Pick<SignFormatInfo, 'format' | 'free' | 'total'>, week: Pick<SignWeek, 'label'>): string {
  switch (info.format) {
    case 'facade':
      return `${info.free} of ${info.total} spots free ${weekPhrase(week)}`;
    case 'hologram':
      return `${info.free} of ${info.total} free`;
    case 'tonightSlot':
      return info.free > 0 ? 'Per night' : 'Full tonight';
  }
}

/** The price of a format row, split so the unit can be set lighter: { amount: "€40", unit: "/wk" }. */
export function formatPrice(info: Pick<SignFormatInfo, 'price' | 'unit'>): { amount: string; unit: string } {
  return { amount: euros(info.price), unit: info.unit === 'week' ? '/wk' : '' };
}

/**
 * The spots a host can book in a format: free in the week shown, and either on nobody's building or
 * on the host's own (a venue's own wall is only for that venue). Lowest number first.
 */
export function bookableSpots(spots: readonly SignSpot[], format: SignFormat, venueId: string | null | undefined): SignSpot[] {
  if (format === 'tonightSlot') return [];
  return spots
    .filter((s) => s.format === format && s.free && (s.venueId === null || s.venueId === venueId))
    .sort((a, b) => a.number - b.number);
}

/** The spot to show and book: the one picked while it is still bookable, else the first bookable one. */
export function pickSpot(
  spots: readonly SignSpot[],
  format: SignFormat,
  venueId: string | null | undefined,
  pickedId: string | null,
): SignSpot | null {
  const open = bookableSpots(spots, format, venueId);
  return open.find((s) => s.id === pickedId) ?? open[0] ?? null;
}

/** "Spot 3, Njegoševa": the spot in the preview's label and in the spot chooser. */
export function spotLabel(spot: Pick<SignSpot, 'number' | 'label'>): string {
  return `Spot ${spot.number}, ${spot.label}`;
}

/** The local date of a moment as "2026-11-13", in the phone's time. */
export function localDateKey(at: Date): string {
  const m = at.getMonth() + 1;
  const d = at.getDate();
  return `${at.getFullYear()}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`;
}

/** The night a moment belongs to, as a date key: before 06:00 counts as the night before. */
export function nightKey(at: Date): string {
  return localDateKey(new Date(at.getTime() - NIGHT_ENDS_HOUR * 3_600_000));
}

/** "tonight" when the party is on tonight's night, else its short day: "Fri 14". */
export function nightWord(startsAt: string, now: Date): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return 'tonight';
  if (nightKey(start) === nightKey(now)) return 'tonight';
  const night = new Date(start.getTime() - NIGHT_ENDS_HOUR * 3_600_000);
  return `${WEEKDAYS[night.getDay()]} ${night.getDate()}`;
}

/**
 * The booking button: "Book spot 3 for €40"; for a slot in Tonight "Book tonight's slot for €15",
 * or "Book the Fri 14 slot for €15" for a party on another night.
 */
export function bookLabel(input: { format: SignFormat; spotNumber: number | null; price: number; night: string | null }): string {
  const price = euros(input.price);
  if (input.format === 'tonightSlot') {
    return !input.night || input.night === 'tonight' ? `Book tonight's slot for ${price}` : `Book the ${input.night} slot for ${price}`;
  }
  return input.spotNumber === null ? `Book for ${price}` : `Book spot ${input.spotNumber} for ${price}`;
}

/** The price a booking will record: the spot's own weekly price when it has one, else the format's. */
export function bookingPrice(format: SignFormatInfo | undefined, spot: SignSpot | null): number {
  if (spot && spot.weeklyPrice > 0 && format?.format !== 'tonightSlot') return spot.weeklyPrice;
  return format?.price ?? 0;
}

// ── dates of a booking ("2026-11-17" style dates, read as calendar days) ──

function parseDay(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** "Fri 14 Nov" for a calendar day. */
export function dayText(day: string): string {
  const d = parseDay(day);
  return d ? `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` : '';
}

/** "17–23 Nov", "28 Nov – 4 Dec", or one day "Fri 14 Nov". */
export function dateRange(startsOn: string, endsOn: string): string {
  const a = parseDay(startsOn);
  const b = parseDay(endsOn);
  if (!a || !b) return '';
  if (a.getTime() === b.getTime()) return dayText(startsOn);
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
  }
  return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
}

// ── a booking's place and state ──

/** "Spot 3, Njegoševa", "Rooftop 1, Bokeška", "Slot in Tonight, Neon Friday". */
export function bookingTitle(booking: Pick<SignBooking, 'format' | 'spot' | 'partyTitle'>): string {
  if (booking.format === 'tonightSlot') return booking.partyTitle ? `Slot in Tonight, ${booking.partyTitle}` : 'Slot in Tonight';
  if (!booking.spot) return booking.format === 'hologram' ? 'Rooftop hologram' : 'Facade panel';
  return booking.format === 'hologram'
    ? `Rooftop ${booking.spot.number}, ${booking.spot.label}`
    : spotLabel(booking.spot);
}

export type BookingStateKind = 'review' | 'upcoming' | 'live' | 'rejected' | 'ended' | 'cancelled';

/**
 * Where a booking stands on a given day (`today` as "2026-11-13"): "In review", "Live", "Not approved",
 * "Ended", "Cancelled", or approved and still to come ("From Mon 17 Nov").
 */
export function bookingState(
  booking: Pick<SignBooking, 'status' | 'startsOn' | 'endsOn'>,
  today: string,
): { kind: BookingStateKind; label: string } {
  const started = booking.startsOn.slice(0, 10) <= today;
  const ended = booking.endsOn.slice(0, 10) < today;
  switch (booking.status) {
    case 'cancelled':
      return { kind: 'cancelled', label: 'Cancelled' };
    case 'rejected':
      return { kind: 'rejected', label: 'Not approved' };
    case 'pendingReview':
      return ended ? { kind: 'ended', label: 'Ended' } : { kind: 'review', label: 'In review' };
    case 'approved':
      if (ended) return { kind: 'ended', label: 'Ended' };
      if (started) return { kind: 'live', label: 'Live' };
      return { kind: 'upcoming', label: `From ${dayText(booking.startsOn)}` };
  }
}

/** The server takes a cancel while a booking is in review, or approved and not yet up (`sign_running` otherwise). */
export function canCancel(booking: Pick<SignBooking, 'status' | 'startsOn' | 'endsOn'>, today: string): boolean {
  const kind = bookingState(booking, today).kind;
  return kind === 'review' || kind === 'upcoming';
}
