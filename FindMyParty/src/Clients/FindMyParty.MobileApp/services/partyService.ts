import { authService, fetchWithTimeout } from './authService';
import { ApiConstants } from '../constants/api';
import { Alert } from 'react-native';
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

  async getParties(lat?: number, lng?: number, date?: string): Promise<PartyMapItem[]> {
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      if (lat != null) params.set('lat', String(lat));
      if (lng != null) params.set('lng', String(lng));
      if (date) params.set('date', date);

      const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/parties?${params}`, {});
      if (!response.ok) return [];
      return response.json();
    } catch {
      Alert.alert('Connection error', 'Could not load parties. Check your internet connection.');
      return [];
    }
  },

  async getPartyById(partyId: string): Promise<PartyDetail | null> {
    try {
      const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}`, {});
      if (!response.ok) return null;
      return response.json();
    } catch {
      Alert.alert('Connection error', 'Could not load party details.');
      return null;
    }
  },

  async getPartyAvailability(partyId: string): Promise<PartyAvailability | null> {
    try {
      const response = await fetchWithTimeout(
        `${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}/availability`, {}
      );
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  },

  // ── Host ──────────────────────────────────────────────────────────────────

  async getMyParties(): Promise<HostPartyResponse[]> {
    try {
      const token = await authService.getToken();
      if (!token) return [];

      const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/parties/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      return response.json();
    } catch {
      Alert.alert('Connection error', 'Could not load your parties.');
      return [];
    }
  },

  async createParty(request: CreatePartyRequest): Promise<string | null> {
    const token = await authService.getToken();
    if (!token) return null;

    const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/parties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) return null;

    const location = response.headers.get('Location');
    if (location) return location.split('/').pop() ?? null;

    const data = await response.json().catch(() => null);
    return data?.id ?? null;
  },

  async publishParty(partyId: string): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;

    const response = await fetchWithTimeout(
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

    const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}`, {
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

    const response = await fetchWithTimeout(
      `${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}/cancel`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.ok;
  },

  async uploadPartyImage(partyId: string, imageUri: string): Promise<string | null> {
    const token = await authService.getToken();
    if (!token) return null;

    const filename = imageUri.split('/').pop() ?? 'image.jpg';
    const ext = filename.split('.').pop() ?? 'jpg';

    const formData = new FormData();
    formData.append('file', { uri: imageUri, name: filename, type: `image/${ext}` } as any);

    const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.imageUrl ?? null;
  },

  async deleteParty(partyId: string): Promise<boolean> {
    const token = await authService.getToken();
    if (!token) return false;

    const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok;
  },
};
