import { useState, useCallback } from 'react';
import { bookingService } from '../services/bookingService';
import type { BookingItem } from '../types/bookings';

export function useMyBookings() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookingService.getMyBookings();
      setBookings(data);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    bookings,
    loading,
    isEmpty: !loading && bookings.length === 0,
    load,
  };
}
