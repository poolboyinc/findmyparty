import { useState, useCallback } from 'react';
import { authService } from '../services/authService';
import { bookingService } from '../services/bookingService';
import type { UserInfo } from '../types/auth';

export function useProfile() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [bookingCount, setBookingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [user, bookings] = await Promise.all([
        authService.getUserInfo(),
        bookingService.getMyBookings(),
      ]);
      setUserInfo(user);
      setBookingCount(bookings.length);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setUserInfo(null);
    setBookingCount(0);
    await authService.logout();
  }, []);

  return { userInfo, bookingCount, loading, load, logout };
}
