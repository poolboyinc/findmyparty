import { authService } from './authService';
import { ApiConstants } from '../constants/api';
import type { BookingItem } from '../types/bookings';

export const bookingService = {
  async getMyBookings(): Promise<BookingItem[]> {
    const token = await authService.getToken();
    if (!token) return [];

    const response = await fetch(`${ApiConstants.GatewayBaseUrl}/api/bookings/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    return response.json();
  },

  async createBooking(partyId: string, ticketCount: number): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;

    const response = await fetch(`${ApiConstants.GatewayBaseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ partyId, ticketCount }),
    });
    return response.ok;
  },

  async cancelBooking(bookingId: string): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;

    const response = await fetch(`${ApiConstants.GatewayBaseUrl}/api/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok;
  },

  async confirmBooking(bookingId: string): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;

    const response = await fetch(
      `${ApiConstants.GatewayBaseUrl}/api/bookings/${bookingId}/confirm`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.ok;
  },

  async getPartyBookings(partyId: string): Promise<BookingItem[]> {
    const token = await authService.getToken();
    if (!token) return [];

    const response = await fetch(
      `${ApiConstants.GatewayBaseUrl}/api/bookings/party/${partyId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) return [];
    return response.json();
  },
};
