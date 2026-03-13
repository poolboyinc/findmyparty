import { authService } from './authService';
import { ApiConstants } from '../constants/api';
import type {
  CreatePartyRequest,
  HostPartyResponse,
  PartyAvailability,
  PartyDetail,
  PartyMapItem,
  UpdatePartyRequest,
} from '../types/parties';

export const partyService = {
  // ── Public ────────────────────────────────────────────────────────────────

  async getParties(lat: number, lng: number, date?: string): Promise<PartyMapItem[]> {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      page: '1',
      pageSize: '100',
    });
    if (date) params.set('date', date);

    const response = await fetch(`${ApiConstants.GatewayBaseUrl}/api/parties?${params}`);
    if (!response.ok) return [];
    return response.json();
  },

  async getPartyById(partyId: string): Promise<PartyDetail | null> {
    const response = await fetch(`${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}`);
    if (!response.ok) return null;
    return response.json();
  },

  async getPartyAvailability(partyId: string): Promise<PartyAvailability | null> {
    const response = await fetch(
      `${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}/availability`
    );
    if (!response.ok) return null;
    return response.json();
  },

  // ── Host ──────────────────────────────────────────────────────────────────

  async getMyParties(): Promise<HostPartyResponse[]> {
    const token = await authService.getToken();
    if (!token) return [];

    const response = await fetch(`${ApiConstants.GatewayBaseUrl}/api/parties/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    return response.json();
  },

  async createParty(request: CreatePartyRequest): Promise<string | null> {
    const token = await authService.getToken();
    if (!token) return null;

    const response = await fetch(`${ApiConstants.GatewayBaseUrl}/api/parties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) return null;

    // Returns the created party id from the Location header or body
    const location = response.headers.get('Location');
    if (location) return location.split('/').pop() ?? null;

    const data = await response.json().catch(() => null);
    return data?.id ?? null;
  },

  async publishParty(partyId: string): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;

    const response = await fetch(
      `${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}/publish`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.ok;
  },

  async updateParty(partyId: string, request: UpdatePartyRequest): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;

    const response = await fetch(`${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });
    return response.ok;
  },

  async cancelParty(partyId: string): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;

    const response = await fetch(
      `${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}/cancel`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.ok;
  },

  async deleteParty(partyId: string): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;

    const response = await fetch(`${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok;
  },
};
