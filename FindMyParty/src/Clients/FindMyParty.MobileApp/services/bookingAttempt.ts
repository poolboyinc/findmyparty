// Pure booking rules, unit-tested in services/__tests__/bookingAttempt.test.mjs.

/** Guests on one booking. The server enforces the same limit. */
export const MAX_GUESTS_PER_BOOKING = 6;

/** How many guests the picker may go up to, given the spots left. */
export function guestLimit(remainingSpots: number): number {
  return Math.max(0, Math.min(remainingSpots, MAX_GUESTS_PER_BOOKING));
}

export interface BookingAttempt {
  /** Sent as the Idempotency-Key header. */
  key: string;
  partyId: string;
  ticketCount: number;
}

/**
 * The attempt to send. Asking for the same party and guest count as last time is a retry and
 * keeps its key, so a request that timed out but reached the server is not booked twice.
 * Pass `null` as `prev` once a booking has succeeded.
 */
export function nextAttempt(
  prev: BookingAttempt | null,
  partyId: string,
  ticketCount: number,
  newKey: () => string,
): BookingAttempt {
  if (prev && prev.partyId === partyId && prev.ticketCount === ticketCount) return prev;
  return { key: newKey(), partyId, ticketCount };
}
