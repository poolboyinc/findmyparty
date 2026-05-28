// Booking types
//
// Two shapes live here:
//   - `UserBooking` — the new "My Tickets" shape. Each row is enriched with a
//     slim `BookingParty` payload (title, image, time, location, genre, performer),
//     allowing the consumer screen to render an image-led ticket card without
//     a per-row party fetch. Returned by `GET /api/bookings/my`.
//   - `BookingItem` — the legacy slim shape still returned by the host-side
//     `GET /api/bookings/party/{partyId}` endpoint. KEEP this exported until
//     that endpoint is migrated; host `party-bookings.tsx` and the
//     `bookingService.getPartyBookings` call site depend on it.
//
// Status helpers below are `@deprecated` — they returned hard-coded hex values.
// New code MUST derive booking-status visuals from theme tokens instead (see
// `app/my-bookings.tsx` `mapStatusVisual`).

export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled';

/** Slim party DTO embedded on every `UserBooking`. `null` when the cross-service
 *  party lookup failed (consumer renders a "Party details unavailable" fallback). */
export interface BookingParty {
  id: string;
  title: string;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  latitude: number;
  longitude: number;
  genre: string | null;
  performerName: string | null;
  performerType: string | null;
  /** "Draft" | "Published" | "Cancelled" | "SoldOut" — left as `string` to
   *  tolerate unknown server values without crashing the UI. */
  status: string;
}

/** Enriched booking row returned by `GET /api/bookings/my`. */
export interface UserBooking {
  id: string;
  partyId: string;
  ticketCount: number;
  totalPrice: number;
  /** Server returns a free-string status; consumers narrow to `BookingStatus`. */
  status: string;
  createdAt: string;
  partyEndsAt: string;
  /**
   * Enriched party metadata from the new cross-service lookup. `null` is the
   * documented "lookup failed / party was hard-deleted" signal. `undefined`
   * can appear briefly during a rolling Railway deploy when the OLD
   * Bookings.API response shape (which didn't carry this field at all) is
   * still being served — the consumer card must treat both the same.
   */
  party?: BookingParty | null;
}

/**
 * @deprecated Slim shape used by the host-side party-bookings endpoint.
 *  Do NOT use for consumer "My Tickets" — use `UserBooking` there. Kept exported
 *  until `GET /api/bookings/party/{partyId}` is migrated to the enriched shape.
 */
export interface BookingItem {
  id: string;
  partyId: string;
  ticketCount: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  partyEndsAt: string;
}

/**
 * @deprecated Returns a hard-coded hex value. Use theme tokens
 *  (e.g. `colors.success`, `colors.warning`, `colors.danger`) via a local
 *  `mapStatusVisual` helper instead. Kept for backwards compatibility only —
 *  will be removed once all callers migrate.
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'Confirmed': return '#22C55E';
    case 'Cancelled': return '#6B7280';
    default: return '#F59E0B';
  }
}

/**
 * @deprecated See `getStatusColor`.
 */
export function getStatusBackgroundColor(status: string): string {
  switch (status) {
    case 'Confirmed': return '#0A2D0A';
    case 'Cancelled': return '#1C1C1C';
    default: return '#2D1F00';
  }
}

/**
 * @deprecated See `getStatusColor`.
 */
export function getStatusBorderColor(status: string): string {
  switch (status) {
    case 'Confirmed': return '#22C55E';
    case 'Cancelled': return '#4B5563';
    default: return '#F59E0B';
  }
}
