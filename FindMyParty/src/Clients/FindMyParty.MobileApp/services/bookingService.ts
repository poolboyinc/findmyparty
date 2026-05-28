import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { authService, fetchWithTimeout } from './authService';
import { ApiConstants } from '../constants/api';
import type { BookingItem, UserBooking } from '../types/bookings';

export const bookingService = {
  async getMyBookings(): Promise<UserBooking[]> {
    try {
      const token = await authService.getToken();
      if (!token) return [];

      const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/bookings/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      return response.json();
    } catch {
      // Network/timeout failure — return empty so callers can render an empty
      // state. Do NOT pop a modal alert from a passive fetch on tab focus.
      return [];
    }
  },

  async createBooking(partyId: string, ticketCount: number): Promise<string | null> {
    const token = await authService.getToken();
    if (!token) return null;

    const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': uuidv4(),
      },
      body: JSON.stringify({ partyId, ticketCount }),
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return data?.bookingId ?? null;
  },

  async cancelBooking(bookingId: string): Promise<boolean> {
    try {
      const token = await authService.getToken();
      if (!token) return false;

      const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.ok;
    } catch {
      // Caller (my-bookings screen) surfaces the failure inline inside the
      // cancel confirmation sheet — no Alert.alert. Service layer stays silent.
      return false;
    }
  },

  async confirmBooking(bookingId: string): Promise<boolean> {
    try {
      const token = await authService.getToken();
      if (!token) return false;

      const response = await fetchWithTimeout(
        `${ApiConstants.GatewayBaseUrl}/api/bookings/${bookingId}/confirm`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return response.ok;
    } catch {
      // Caller owns the failure UX (currently unused, but pattern preserved).
      return false;
    }
  },

  async getPartyBookings(partyId: string): Promise<BookingItem[]> {
    try {
      const token = await authService.getToken();
      if (!token) return [];

      const response = await fetchWithTimeout(
        `${ApiConstants.GatewayBaseUrl}/api/bookings/party/${partyId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) return [];
      return response.json();
    } catch {
      // Host party-bookings screen renders empty list on failure.
      return [];
    }
  },
};
