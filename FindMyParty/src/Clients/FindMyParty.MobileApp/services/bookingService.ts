import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { authService, fetchWithTimeout } from './authService';
import { ApiConstants } from '../constants/api';
import { Alert } from 'react-native';
import type { BookingItem } from '../types/bookings';

export const bookingService = {
  async getMyBookings(): Promise<BookingItem[]> {
    try {
      const token = await authService.getToken();
      if (!token) return [];

      const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/bookings/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      return response.json();
    } catch {
      Alert.alert('Connection error', 'Could not load your bookings.');
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
      Alert.alert('Connection error', 'Could not cancel booking.');
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
      Alert.alert('Connection error', 'Could not confirm booking.');
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
      Alert.alert('Connection error', 'Could not load bookings.');
      return [];
    }
  },
};
