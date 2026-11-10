// Server data for screens. Every hook goes through the API client, so errors are `ApiError`s
// (use `errorText(error)` for the sentence to show) and results are cached and shared.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/apiClient';
import { authService } from '@/services/authService';
import type {
  Booking,
  CheckInPreview,
  CheckInResult,
  HostParty,
  HostVenue,
  Party,
  PartyDetail,
  PartyLive,
  Pass,
  Venue,
  VenueSummary,
} from '@/types/api';
import type { UserInfo } from '@/types/auth';

export const keys = {
  me: ['me'] as const,
  parties: ['parties'] as const,
  party: (id: string) => ['party', id] as const,
  venues: ['venues'] as const,
  venue: (id: string) => ['venue', id] as const,
  bookings: ['bookings'] as const,
  pass: (bookingId: string) => ['pass', bookingId] as const,
  hostParties: ['host', 'parties'] as const,
  hostVenue: ['host', 'venue'] as const,
  partyLive: (id: string) => ['host', 'live', id] as const,
};

// ── who is signed in ──

/** The signed-in user (from the token), or null. `roles` says whether they are a Host or Admin. */
export function useMe() {
  return useQuery<UserInfo | null>({ queryKey: keys.me, queryFn: () => authService.getUserInfo(), staleTime: 60_000 });
}

// ── guests ──

/** Open parties, soonest first, each with its venue name and crowd range. */
export function useParties() {
  return useQuery({ queryKey: keys.parties, queryFn: () => api.request<Party[]>('/api/parties?pageSize=100', { auth: false }) });
}

export function useParty(id: string | undefined) {
  return useQuery({
    queryKey: keys.party(id ?? ''),
    queryFn: () => api.request<PartyDetail>(`/api/parties/${id}`, { auth: false }),
    enabled: !!id,
  });
}

/** Venues for the map: one entry per venue with its next party and crowd range. Refreshes every minute. */
export function useVenues() {
  return useQuery({
    queryKey: keys.venues,
    queryFn: () => api.request<VenueSummary[]>('/api/venues?pageSize=200', { auth: false }),
    refetchInterval: 60_000,
  });
}

export function useVenue(id: string | undefined) {
  return useQuery({
    queryKey: keys.venue(id ?? ''),
    queryFn: () => api.request<Venue>(`/api/venues/${id}`, { auth: false }),
    enabled: !!id,
  });
}

/** The signed-in guest's bookings, newest first, with party and venue details. */
export function useMyBookings() {
  return useQuery({ queryKey: keys.bookings, queryFn: () => api.request<Booking[]>('/api/bookings/my') });
}

/**
 * A booking's pass. Kept for a day so it still shows with no signal at the door.
 * Pass `watch: true` while the pass is on screen to notice the moment the door scans it.
 */
export function usePass(bookingId: string | undefined, options: { watch?: boolean } = {}) {
  return useQuery({
    queryKey: keys.pass(bookingId ?? ''),
    queryFn: () => api.request<Pass>(`/api/bookings/${bookingId}/pass`),
    enabled: !!bookingId,
    staleTime: 0,
    gcTime: 24 * 60 * 60_000,
    refetchInterval: options.watch ? 4_000 : false,
  });
}

/**
 * Books spots. `idempotencyKey` must be the same when retrying the same booking: use `nextAttempt`
 * from services/bookingAttempt. Fails with ApiError codes `sold_out`, `not_bookable`, `ticket_count`.
 */
export function useCreateBooking() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { partyId: string; ticketCount: number; idempotencyKey: string }) =>
      api.request<{ bookingId: string }>('/api/bookings', {
        method: 'POST',
        body: { partyId: input.partyId, ticketCount: input.ticketCount },
        headers: { 'Idempotency-Key': input.idempotencyKey },
      }),
    onSuccess: (_data, input) => {
      client.invalidateQueries({ queryKey: keys.bookings });
      client.invalidateQueries({ queryKey: keys.parties });
      client.invalidateQueries({ queryKey: keys.party(input.partyId) });
    },
  });
}

/** Cancels the guest's own booking and gives the spots back. */
export function useCancelBooking() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => api.request<void>(`/api/bookings/${bookingId}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.bookings });
      client.invalidateQueries({ queryKey: keys.parties });
    },
  });
}

// ── hosts ──

export function useHostParties() {
  return useQuery({ queryKey: keys.hostParties, queryFn: () => api.request<HostParty[]>('/api/parties/mine') });
}

export function useHostVenue() {
  return useQuery({ queryKey: keys.hostVenue, queryFn: () => api.request<HostVenue>('/api/hosts/profile') });
}

/** The night in numbers for one of the host's parties. Refreshes every 10 seconds while mounted. */
export function usePartyLive(partyId: string | undefined) {
  return useQuery({
    queryKey: keys.partyLive(partyId ?? ''),
    queryFn: () => api.request<PartyLive>(`/api/parties/${partyId}/live`),
    enabled: !!partyId,
    refetchInterval: 10_000,
  });
}

/**
 * Looks at a scanned pass without letting anyone in: who it is and how many are still outside.
 * Fails with the same ApiError codes as `useCheckIn`. Show the result, then call `useCheckIn` with `admit`.
 */
export function useCheckInPreview() {
  return useMutation({
    mutationFn: (code: string) => api.request<CheckInPreview>('/api/checkins/preview', { method: 'POST', body: { code } }),
  });
}

/**
 * Lets guests in at the door. `code` is the text read from the QR. `admit` lets in part of a group.
 * Fails with ApiError codes `invalid_code`, `code_expired`, `already_used`, `booking_cancelled`,
 * `party_cancelled`, `party_over`, or kind `forbidden` for another host's party.
 */
export function useCheckIn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string; admit?: number }) =>
      api.request<CheckInResult>('/api/checkins', { method: 'POST', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['host', 'live'] }),
  });
}
