import { authService, fetchWithTimeout } from './authService';
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
      // Network/timeout failure — return empty so callers can render an empty
      // state. Do NOT pop a modal alert from a passive fetch; that interrupts
      // the user with something they didn't ask for. Caller owns error UX.
      return [];
    }
  },

  async getPartyById(partyId: string): Promise<PartyDetail | null> {
    try {
      const response = await fetchWithTimeout(`${ApiConstants.GatewayBaseUrl}/api/parties/${partyId}`, {});
      if (!response.ok) return null;
      return response.json();
    } catch {
      // See getParties: silent failure, caller renders "Party not found".
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
      // Normalize numeric fields at the data boundary so every host screen
      // inherits safe numbers — a missing ticketsSold/revenue would otherwise
      // surface as NaN in aggregations and "NaN" in the UI.
      const data: HostPartyResponse[] = await response.json();
      return data.map((p) => ({
        ...p,
        ticketsSold: Number(p.ticketsSold) || 0,
        revenue: Number(p.revenue) || 0,
      }));
    } catch {
      // See getParties: silent failure, host dashboard renders empty list.
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

    // Prefer body (reliable), fall back to Location header
    const data = await response.json().catch(() => null);
    if (data?.id) return data.id;

    const location = response.headers.get('Location');
    if (location) {
      // Extract GUID from path like /api/parties/{id}
      const match = location.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (match) return match[0];
    }

    return null;
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

    const formData = new FormData();
    // Server validates and re-encodes to JPEG regardless of what we send here.
    // Use a fixed content type — never derive it from the client filename.
    formData.append('file', { uri: imageUri, name: 'upload.jpg', type: 'image/jpeg' } as any);

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
