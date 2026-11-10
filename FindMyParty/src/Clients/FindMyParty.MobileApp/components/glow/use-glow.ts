import { useMemo } from 'react';
import { useMyBookings } from '@/hooks/queries';
import { glowFrom, type Glow } from '@/services/glow';

/** The guest's Glow, worked out from their bookings. `glow` is null until the bookings have loaded. */
export function useGlow(): { glow: Glow | null; bookings: ReturnType<typeof useMyBookings> } {
  const bookings = useMyBookings();
  const glow = useMemo(() => (bookings.data ? glowFrom(bookings.data, new Date()) : null), [bookings.data]);
  return { glow, bookings };
}
