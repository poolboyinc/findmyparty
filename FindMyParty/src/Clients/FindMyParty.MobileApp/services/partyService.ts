import { fetchWithTimeout } from './authService';
import { api } from './apiClient';
import { ApiConstants } from '../constants/api';
import type { HostParty, PartyInput } from '../types/api';
import type { PartyAvailability, PartyDetail, PartyMapItem } from '../types/parties';

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
  // Through the API client, so a refusal arrives as an `ApiError` with its code (`acts_invalid`,
  // `storage_off`, ...) and the screen can say why with `errorText`.

  async getMyParties(): Promise<HostParty[]> {
    return api.request<HostParty[]>('/api/parties/mine');
  },

  /** Makes a draft. Returns its id. */
  async createParty(input: PartyInput): Promise<string> {
    const created = await api.request<{ id: string }>('/api/parties', { method: 'POST', body: input });
    return created.id;
  },

  /** Changes a draft (the server refuses a published party; its line-up goes through `useSetActs`). */
  async updateParty(partyId: string, input: PartyInput): Promise<void> {
    await api.request<void>(`/api/parties/${partyId}`, { method: 'PATCH', body: input });
  },

  async publishParty(partyId: string): Promise<void> {
    await api.request<void>(`/api/parties/${partyId}/publish`, { method: 'POST' });
  },

  async cancelParty(partyId: string): Promise<void> {
    await api.request<void>(`/api/parties/${partyId}/cancel`, { method: 'POST' });
  },

  async deleteParty(partyId: string): Promise<void> {
    await api.request<void>(`/api/parties/${partyId}`, { method: 'DELETE' });
  },

  /** Uploads the cover from a local image URI. Fails with `storage_off` until storage is set up. */
  async uploadPartyImage(partyId: string, imageUri: string): Promise<string | null> {
    const form = new FormData();
    // React Native's FormData takes a `{ uri, name, type }` file reference. The server re-encodes it,
    // so the type is fixed rather than taken from the file name.
    form.append('file', { uri: imageUri, name: 'upload.jpg', type: 'image/jpeg' } as unknown as Blob);
    const data = await api.request<{ imageUrl?: string }>(`/api/parties/${partyId}/image`, { method: 'POST', body: form });
    return data?.imageUrl ?? null;
  },
};
