// Server data for screens (BUILD-3-SPEC §3.2). Every hook goes through the API client, so errors are
// `ApiError`s (use `errorText(error)` for the sentence to show) and results are cached and shared.
//
// Who is asking:
// - no option: a session is needed. Signed out, the hook fails at once with kind `signed_out`, without a request.
// - `OPTIONAL` (`auth: 'optional'`): works signed out; with a session the server adds what is the viewer's own
//   (`friendsHere`, `following`, `perks`, ...). These are refetched after sign-in because `enterApp` invalidates everything.
// - `PUBLIC` (`auth: false`): never sends a token.
//
// Mutations invalidate the keys the spec names; the ones marked optimistic change the cache first and
// put it back if the server says no.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/services/apiClient';
import { authService } from '@/services/authService';
import type {
  AdminReport,
  AdminSign,
  BatchScanItem,
  BatchScanResult,
  Booking,
  BookingQuote,
  CheckInPreview,
  CheckInResult,
  City,
  DoorContext,
  DoorManifest,
  DoorStaff,
  DoorStaffCreated,
  FriendsList,
  FriendsOut,
  GlowAward,
  GlowSummary,
  GuestPass,
  GuestPassPreview,
  HostBooking,
  HostParty,
  HostPerk,
  HostVenue,
  MapSign,
  Me,
  NightRecap,
  NightSummary,
  Party,
  PartyAct,
  PartyDetail,
  PartyLive,
  Pass,
  PerkClaim,
  PerkItem,
  ReportReason,
  Saved,
  SignBooking,
  SignInput,
  SignOptions,
  UserCard,
  Venue,
  VenueSummary,
} from '@/types/api';
import type { UserInfo } from '@/types/auth';

const OPTIONAL = { auth: 'optional' } as const;
const PUBLIC = { auth: false } as const;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * Cache keys. A key without its last part is a prefix: `invalidateQueries({ queryKey: keys.parties })`
 * reaches every city's list.
 */
export const keys = {
  me: ['me'] as const,
  profile: ['profile'] as const,
  cities: ['cities'] as const,
  parties: ['parties'] as const,
  partyList: (city?: string) => ['parties', city] as const,
  party: (id: string) => ['party', id] as const,
  venues: ['venues'] as const,
  venueList: (city?: string) => ['venues', city] as const,
  venue: (id: string) => ['venue', id] as const,
  saved: ['saved'] as const,
  quotes: ['quote'] as const,
  quote: (partyId: string, ticketCount: number) => ['quote', partyId, ticketCount] as const,
  bookings: ['bookings'] as const,
  passes: ['pass'] as const,
  pass: (id: string) => ['pass', id] as const,
  guestPass: (token: string) => ['guestPass', token] as const,
  glow: ['glow'] as const,
  award: (bookingId: string) => ['award', bookingId] as const,
  perks: ['perks'] as const,
  perkList: (city?: string) => ['perks', city] as const,
  perk: (id: string) => ['perk', id] as const,
  nights: ['nights'] as const,
  night: (date: string) => ['night', date] as const,
  recap: (token: string) => ['recap', token] as const,
  friends: ['friends'] as const,
  friendsOut: ['friendsOut'] as const,
  friendsOutIn: (city?: string) => ['friendsOut', city] as const,
  userSearch: ['userSearch'] as const,
  userSearchFor: (q: string) => ['userSearch', q] as const,
  user: (handle: string) => ['user', handle] as const,
  signs: ['signs'] as const,
  signList: (city?: string) => ['signs', city] as const,
  hostParties: ['host', 'parties'] as const,
  hostVenue: ['host', 'venue'] as const,
  hostLive: ['host', 'live'] as const,
  partyLive: (id: string) => ['host', 'live', id] as const,
  hostBookings: (partyId: string) => ['host', 'bookings', partyId] as const,
  hostPerks: ['host', 'perks'] as const,
  doorStaff: ['host', 'doorStaff'] as const,
  hostSigns: ['host', 'signs'] as const,
  signOptions: (week?: string) => ['host', 'signs', week] as const,
  door: ['door'] as const,
  doorContext: ['door', 'context'] as const,
  doorManifest: (partyId: string) => ['door', 'manifest', partyId] as const,
  adminSigns: ['admin', 'signs'] as const,
  adminSignList: (status?: string) => ['admin', 'signs', status] as const,
  adminReports: ['admin', 'reports'] as const,
  adminReportList: (status?: string) => ['admin', 'reports', status] as const,
};

/** "?a=1&b=2" from the values that are set; "" when none are. */
function query(params: Record<string, string | number | null | undefined>): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${name}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

const seg = encodeURIComponent;

/**
 * The multipart body for an image upload: one part named `file`, from a local image URI
 * (`expo-image-picker`'s `asset.uri`). The server checks and re-encodes it, so the type here is fixed.
 */
export function imageFormData(imageUri: string): FormData {
  const form = new FormData();
  // React Native's FormData takes a `{ uri, name, type }` file reference where the web takes a Blob.
  form.append('file', { uri: imageUri, name: 'upload.jpg', type: 'image/jpeg' } as unknown as Blob);
  return form;
}

// ── who is signed in ──

/**
 * The signed-in user as the session token says (id, user name, `roles`), or null. Needs no request,
 * so it also works with no signal. For the account itself (display name, city, taste, level) use `useProfile`.
 */
export function useMe() {
  return useQuery<UserInfo | null>({ queryKey: keys.me, queryFn: () => authService.getUserInfo(), staleTime: MINUTE });
}

/** The account: names, city, taste, sound, level, privacy and notification switches. */
export function useProfile() {
  return useQuery({ queryKey: keys.profile, queryFn: () => api.request<Me>('/api/me') });
}

export interface ProfileUpdate {
  /** 1 to 40 characters (`name_invalid`). */
  displayName?: string;
  /** A city slug (`city_unknown`). */
  city?: string;
  /** Genres from `TASTE_ORDER`, in pick order (`taste_invalid`). */
  taste?: string[];
  notifications?: { venues?: boolean; friends?: boolean; nights?: boolean };
}

/** Changes the account. Send only what changed. */
export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileUpdate) => api.request<Me>('/api/me', { method: 'PATCH', body: input }),
    onSuccess: (me, input) => {
      client.setQueryData<Me>(keys.profile, me);
      if (input.city !== undefined || input.taste !== undefined) {
        client.invalidateQueries({ queryKey: keys.parties });
        client.invalidateQueries({ queryKey: keys.venues });
      }
    },
  });
}

/** Asks for a reset mail. The server answers the same whether or not the account exists. */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      api.request<void>('/api/auth/forgot-password', { method: 'POST', body: { email }, ...PUBLIC }),
  });
}

/** Sets a new password with the token from the reset link. Fails with `reset_invalid`, `password_weak`. */
export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; newPassword: string }) =>
      api.request<void>('/api/auth/reset-password', { method: 'POST', body: input, ...PUBLIC }),
  });
}

// ── cities, parties, venues ──

/** The cities with tonight's pulse (`outTonight`, `venuesLit`). Refreshes every minute. */
export function useCities() {
  return useQuery({
    queryKey: keys.cities,
    queryFn: () => api.request<City[]>('/api/cities', PUBLIC),
    refetchInterval: MINUTE,
  });
}

/** Open parties, soonest first, each with its venue name and crowd range. `city` is a slug; without it, every city. */
export function useParties(city?: string) {
  return useQuery({
    queryKey: keys.partyList(city),
    queryFn: () => api.request<Party[]>(`/api/parties${query({ pageSize: 100, city })}`, OPTIONAL),
  });
}

export function useParty(id: string | undefined) {
  return useQuery({
    queryKey: keys.party(id ?? ''),
    queryFn: () => api.request<PartyDetail>(`/api/parties/${id}`, OPTIONAL),
    enabled: !!id,
  });
}

/** Venues for the map: one entry per venue with its next party and crowd range. Refreshes every minute. */
export function useVenues(city?: string) {
  return useQuery({
    queryKey: keys.venueList(city),
    queryFn: () => api.request<VenueSummary[]>(`/api/venues${query({ pageSize: 200, city })}`, OPTIONAL),
    refetchInterval: MINUTE,
  });
}

export function useVenue(id: string | undefined) {
  return useQuery({
    queryKey: keys.venue(id ?? ''),
    queryFn: () => api.request<Venue>(`/api/venues/${id}`, OPTIONAL),
    enabled: !!id,
  });
}

/** Follows or unfollows a venue. Optimistic: `Venue.following` flips at once. */
export function useFollowVenue() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { venueId: string; follow: boolean }) =>
      api.request<void>(`/api/venues/${input.venueId}/follow`, { method: input.follow ? 'PUT' : 'DELETE' }),
    onMutate: async ({ venueId, follow }) => {
      await client.cancelQueries({ queryKey: keys.venue(venueId) });
      const previous = client.getQueryData<Venue>(keys.venue(venueId));
      if (previous) client.setQueryData<Venue>(keys.venue(venueId), { ...previous, following: follow });
      return { previous };
    },
    onError: (_error, { venueId }, context) => {
      if (context?.previous) client.setQueryData<Venue>(keys.venue(venueId), context.previous);
    },
    onSettled: (_data, _error, { venueId }) => client.invalidateQueries({ queryKey: keys.venue(venueId) }),
  });
}

// ── saved ──

/** Ids of the parties and venues the user saved. */
export function useSaved() {
  return useQuery({ queryKey: keys.saved, queryFn: () => api.request<Saved>('/api/me/saved') });
}

/** Saves or unsaves a party or a venue. Optimistic: the id is in or out of `useSaved()` at once. */
export function useToggleSaved() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: 'party' | 'venue'; id: string; saved: boolean }) =>
      api.request<void>(`/api/me/saved/${input.kind}/${input.id}`, { method: input.saved ? 'PUT' : 'DELETE' }),
    onMutate: async ({ kind, id, saved }) => {
      await client.cancelQueries({ queryKey: keys.saved });
      const previous = client.getQueryData<Saved>(keys.saved);
      if (previous) {
        const list = kind === 'party' ? 'parties' : 'venues';
        const without = previous[list].filter((savedId) => savedId !== id);
        client.setQueryData<Saved>(keys.saved, { ...previous, [list]: saved ? [...without, id] : without });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData<Saved>(keys.saved, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.saved }),
  });
}

// ── bookings and passes ──

/**
 * What a booking for this many guests would cost at the door and until when it would be held.
 * Fails with the same codes as booking (`sold_out`, `not_bookable`, `ticket_count`). Stale after 30 seconds.
 */
export function useBookingQuote(partyId: string | undefined, ticketCount: number) {
  return useQuery({
    queryKey: keys.quote(partyId ?? '', ticketCount),
    queryFn: () => api.request<BookingQuote>(`/api/bookings/quote${query({ partyId, ticketCount })}`),
    enabled: !!partyId && ticketCount > 0,
    staleTime: 30_000,
  });
}

/** The signed-in guest's bookings and the guest passes they took, newest first, with party and venue details. */
export function useMyBookings() {
  return useQuery({ queryKey: keys.bookings, queryFn: () => api.request<Booking[]>('/api/bookings/my') });
}

/**
 * A pass. `id` is `Booking.id`; pass `guest: true` when the row is a guest pass (`Booking.guestPassId` is set).
 * Kept for a day so it still shows with no signal at the door.
 * Pass `watch: true` while the pass is on screen to notice the moment the door scans it.
 */
export function usePass(id: string | undefined, options: { watch?: boolean; guest?: boolean } = {}) {
  return useQuery({
    queryKey: keys.pass(id ?? ''),
    queryFn: () => api.request<Pass>(options.guest ? `/api/guest-passes/${id}/pass` : `/api/bookings/${id}/pass`),
    enabled: !!id,
    staleTime: 0,
    gcTime: DAY,
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
      client.invalidateQueries({ queryKey: keys.quotes });
    },
  });
}

/** Cancels the guest's own booking and gives the spots back. Fails with `guest_inside` once someone is in. */
export function useCancelBooking() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => api.request<void>(`/api/bookings/${bookingId}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.bookings });
      client.invalidateQueries({ queryKey: keys.parties });
      client.invalidateQueries({ queryKey: keys.quotes });
    },
  });
}

/** Turns one spot of a booking into a link for a guest (`GuestPass.url`). Fails with `no_spot_to_give`. */
export function useCreateGuestPass() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) =>
      api.request<GuestPass>(`/api/bookings/${bookingId}/guest-passes`, { method: 'POST' }),
    onSuccess: (_data, bookingId) => {
      client.invalidateQueries({ queryKey: keys.bookings });
      client.invalidateQueries({ queryKey: keys.pass(bookingId) });
    },
  });
}

/** Takes a guest pass back (the booker) or gives it up (the guest). Fails with `guest_inside`. */
export function useRevokeGuestPass() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (guestPassId: string) => api.request<void>(`/api/guest-passes/${guestPassId}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.bookings });
      client.invalidateQueries({ queryKey: keys.passes });
    },
  });
}

/** What a guest-pass link is for, before taking it. Works signed out. */
export function useGuestPassPreview(token: string | undefined) {
  return useQuery({
    queryKey: keys.guestPass(token ?? ''),
    queryFn: () => api.request<GuestPassPreview>(`/api/guest-passes/preview/${seg(token ?? '')}`, PUBLIC),
    enabled: !!token,
  });
}

/** Takes a guest pass. Answers the guest's own row. Fails with `guest_pass_taken`, `guest_pass_own`, `party_over`. */
export function useClaimGuestPass() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.request<Booking>('/api/guest-passes/claim', { method: 'POST', body: { token } }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.bookings }),
  });
}

// ── glow, perks, nights ──

/** Glow: lifetime and balance, level and ladder, streak, badges, the last nights. */
export function useGlow() {
  return useQuery({ queryKey: keys.glow, queryFn: () => api.request<GlowSummary>('/api/me/glow') });
}

/**
 * What a door scan earned. The server answers 404 until it has worked the scan out, so a 404 is
 * tried again three times, 700 ms apart.
 */
export function useGlowAward(bookingId: string | undefined) {
  return useQuery({
    queryKey: keys.award(bookingId ?? ''),
    queryFn: () => api.request<GlowAward>(`/api/me/glow/awards${query({ bookingId })}`),
    enabled: !!bookingId,
    retry: (failureCount, error) =>
      error instanceof ApiError &&
      ((error.kind === 'not_found' && failureCount < 3) || (error.kind === 'offline' && failureCount < 2)),
    retryDelay: 700,
  });
}

/** The user's perks in a city: held, then sponsored, then locked. */
export function usePerks(city: string | undefined) {
  return useQuery({
    queryKey: keys.perkList(city),
    queryFn: () => api.request<PerkItem[]>(`/api/me/perks${query({ city })}`),
    enabled: !!city,
  });
}

/** One sponsored perk, with the user's claim when there is one. */
export function usePerk(id: string | undefined) {
  return useQuery({
    queryKey: keys.perk(id ?? ''),
    queryFn: () => api.request<PerkItem>(`/api/perks/${id}`),
    enabled: !!id,
  });
}

/** Spends Glow on a sponsored perk. Fails with `perk_level`, `perk_glow`, `perk_gone`, `perk_claimed`, `perk_not_live`. */
export function useClaimPerk() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (perkId: string) => api.request<PerkClaim>(`/api/perks/${perkId}/claim`, { method: 'POST' }),
    onSuccess: (_data, perkId) => {
      client.invalidateQueries({ queryKey: keys.perks });
      client.invalidateQueries({ queryKey: keys.perk(perkId) });
      client.invalidateQueries({ queryKey: keys.glow });
    },
  });
}

/** The user's nights out, newest first. */
export function useNights() {
  return useQuery({ queryKey: keys.nights, queryFn: () => api.request<NightSummary[]>('/api/me/nights') });
}

/** One night's recap. `date` is `YYYY-MM-DD`, the night's date in the city. */
export function useNight(date: string | undefined) {
  return useQuery({
    queryKey: keys.night(date ?? ''),
    queryFn: () => api.request<NightRecap>(`/api/me/nights/${seg(date ?? '')}`),
    enabled: !!date,
  });
}

/** Makes the night's share link. */
export function useShareNight() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      api.request<{ shareUrl: string }>(`/api/me/nights/${seg(date)}/share`, { method: 'POST' }),
    onSuccess: (_data, date) => client.invalidateQueries({ queryKey: keys.night(date) }),
  });
}

/** Kills the night's share link. */
export function useUnshareNight() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => api.request<void>(`/api/me/nights/${seg(date)}/share`, { method: 'DELETE' }),
    onSuccess: (_data, date) => client.invalidateQueries({ queryKey: keys.night(date) }),
  });
}

/** Someone's shared night, from the token in the link. Works signed out. */
export function usePublicRecap(token: string | undefined) {
  return useQuery({
    queryKey: keys.recap(token ?? ''),
    queryFn: () => api.request<NightRecap>(`/api/recaps/${seg(token ?? '')}`, PUBLIC),
    enabled: !!token,
  });
}

/**
 * Says who invited this account. Fails with `referrer_unknown`, `referrer_self`, `referrer_late`:
 * none of them is shown, so callers ignore the error.
 */
export function useSetReferrer() {
  return useMutation({
    mutationFn: (handle: string) => api.request<void>('/api/me/referrer', { method: 'POST', body: { handle } }),
  });
}

// ── friends ──

/** Friends, requests both ways, the sharing switches and the invite link. */
export function useFriends() {
  return useQuery({ queryKey: keys.friends, queryFn: () => api.request<FriendsList>('/api/friends') });
}

/** Where friends are right now in a city. Refreshes every minute. With sharing off, `venues` is empty. */
export function useFriendsOut(city: string | undefined) {
  return useQuery({
    queryKey: keys.friendsOutIn(city),
    queryFn: () => api.request<FriendsOut>(`/api/friends/out${query({ city })}`),
    enabled: !!city,
    refetchInterval: MINUTE,
  });
}

/** People by name or @handle. Asks the server from two characters on. */
export function useUserSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: keys.userSearchFor(term),
    queryFn: () => api.request<UserCard[]>(`/api/users/search${query({ q: term })}`),
    enabled: term.length >= 2,
  });
}

export function useUserByHandle(handle: string | undefined) {
  return useQuery({
    queryKey: keys.user(handle ?? ''),
    queryFn: () => api.request<UserCard>(`/api/users/by-handle/${seg(handle ?? '')}`),
    enabled: !!handle,
  });
}

function useFriendsChanged() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: keys.friends });
    client.invalidateQueries({ queryKey: keys.userSearch });
    client.invalidateQueries({ queryKey: keys.friendsOut });
  };
}

/** Asks someone to be friends (a request waiting the other way is accepted). Fails with `blocked`, `too_many`. */
export function useSendFriendRequest() {
  const onSuccess = useFriendsChanged();
  return useMutation({
    mutationFn: (userId: string) => api.request<void>('/api/friends/requests', { method: 'POST', body: { userId } }),
    onSuccess,
  });
}

/** Accepts a request (`FriendRequest.id`). */
export function useAcceptFriend() {
  const onSuccess = useFriendsChanged();
  return useMutation({
    mutationFn: (requestId: string) => api.request<void>(`/api/friends/requests/${requestId}/accept`, { method: 'POST' }),
    onSuccess,
  });
}

/** Unfriends, declines a request from, or withdraws a request to this user. */
export function useRemoveFriend() {
  const onSuccess = useFriendsChanged();
  return useMutation({
    mutationFn: (userId: string) => api.request<void>(`/api/friends/${userId}`, { method: 'DELETE' }),
    onSuccess,
  });
}

/**
 * "Show me on friends' maps" and "Invisible tonight". Send only the switch that changed.
 * Fails with `sharing_suspended`.
 */
export function useSetPrivacy() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { shareWithFriends?: boolean; invisibleTonight?: boolean }) =>
      api.request<{ shareWithFriends: boolean; invisibleUntil: string | null }>('/api/me/privacy', {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.profile });
      client.invalidateQueries({ queryKey: keys.friends });
      client.invalidateQueries({ queryKey: keys.friendsOut });
      client.invalidateQueries({ queryKey: keys.parties });
      client.invalidateQueries({ queryKey: keys.venues });
    },
  });
}

function usePeopleChanged() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: keys.friends });
    client.invalidateQueries({ queryKey: keys.userSearch });
  };
}

/** Reports a user to the platform admin. Fails with `too_many`. */
export function useReportUser() {
  const onSuccess = usePeopleChanged();
  return useMutation({
    mutationFn: (input: { userId: string; reason: ReportReason; note?: string }) =>
      api.request<void>(`/api/users/${input.userId}/report`, {
        method: 'POST',
        body: { reason: input.reason, note: input.note },
      }),
    onSuccess,
  });
}

/** Blocks (`block: true`) or unblocks a user. Blocking also ends the friendship, both ways. */
export function useBlockUser() {
  const onSuccess = usePeopleChanged();
  return useMutation({
    mutationFn: (input: { userId: string; block: boolean }) =>
      api.request<void>(`/api/users/${input.userId}/block`, { method: input.block ? 'PUT' : 'DELETE' }),
    onSuccess,
  });
}

// ── signs on the map ──

/** The signs to draw in a city, already in priority order, without the ones the viewer hid. Refreshes every five minutes. */
export function useSigns(city: string | undefined) {
  return useQuery({
    queryKey: keys.signList(city),
    queryFn: () => api.request<MapSign[]>(`/api/signs${query({ city })}`, OPTIONAL),
    enabled: !!city,
    refetchInterval: 5 * MINUTE,
  });
}

/** Hides a sign for this user. Optimistic: it leaves every loaded city's list at once. */
export function useHideSign() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (signId: string) => api.request<void>(`/api/signs/${signId}/hide`, { method: 'POST' }),
    onMutate: async (signId) => {
      await client.cancelQueries({ queryKey: keys.signs });
      const previous = client.getQueriesData<MapSign[]>({ queryKey: keys.signs });
      client.setQueriesData<MapSign[]>({ queryKey: keys.signs }, (signs) => signs?.filter((sign) => sign.id !== signId));
      return { previous };
    },
    onError: (_error, _signId, context) => {
      for (const [key, signs] of context?.previous ?? []) client.setQueryData(key, signs);
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.signs }),
  });
}

// ── hosts ──

/** The host's parties, past nights included. */
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

export interface HostVenueUpdate {
  venueName: string;
  kind?: string | null;
  area?: string | null;
  /** "HH:mm:ss"; null clears it. */
  workingHoursOpen?: string | null;
  /** "HH:mm:ss"; null clears it. */
  workingHoursClose?: string | null;
  /** Comma-joined day codes, e.g. "THU,FRI,SAT"; null clears it. */
  workingDays?: string | null;
}

export function useUpdateHostVenue() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: HostVenueUpdate) => api.request<void>('/api/hosts/profile', { method: 'PATCH', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.hostVenue }),
  });
}

/** Uploads the venue's image from a local image URI. Fails with `storage_off` until storage is set up. */
export function useUploadVenueImage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (imageUri: string) =>
      api.request<{ imageUrl: string }>('/api/hosts/profile/image', { method: 'POST', body: imageFormData(imageUri) }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.hostVenue }),
  });
}

/** Replaces a party's line-up (0 to 8 acts). Works on a draft and on a published party that has not ended. Fails with `acts_invalid`. */
export function useSetActs() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { partyId: string; acts: PartyAct[] }) =>
      api.request<void>(`/api/parties/${input.partyId}/acts`, { method: 'PUT', body: { acts: input.acts } }),
    onSuccess: (_data, input) => {
      client.invalidateQueries({ queryKey: keys.hostParties });
      client.invalidateQueries({ queryKey: keys.party(input.partyId) });
    },
  });
}

/** Who booked one of the host's parties. */
export function usePartyBookings(partyId: string | undefined) {
  return useQuery({
    queryKey: keys.hostBookings(partyId ?? ''),
    queryFn: () => api.request<HostBooking[]>(`/api/bookings/party/${partyId}`),
    enabled: !!partyId,
  });
}

/** The three level perks a venue can offer, each on or off. */
export function useHostPerks() {
  return useQuery({ queryKey: keys.hostPerks, queryFn: () => api.request<HostPerk[]>('/api/hosts/perks') });
}

/** Switches a level perk on or off. `untilLocalTime` ("HH:mm") is for free entry. */
export function useSetHostPerk() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: HostPerk['kind']; enabled: boolean; untilLocalTime?: string | null }) =>
      api.request<void>(`/api/hosts/perks/${input.kind}`, {
        method: 'PUT',
        body: { enabled: input.enabled, untilLocalTime: input.untilLocalTime },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.hostPerks }),
  });
}

/** The venue's door logins. */
export function useDoorStaff() {
  return useQuery({ queryKey: keys.doorStaff, queryFn: () => api.request<DoorStaff[]>('/api/hosts/door-staff') });
}

/** Makes a door login. The answer carries its password, once. Fails with `door_staff_limit`. */
export function useAddDoorStaff() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; doorName: string }) =>
      api.request<DoorStaffCreated>('/api/hosts/door-staff', { method: 'POST', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.doorStaff }),
  });
}

/** Gives a door login a new password, shown once. */
export function useResetDoorPassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.request<{ password: string }>(`/api/hosts/door-staff/${id}/reset-password`, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.doorStaff }),
  });
}

export function useRemoveDoorStaff() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.request<void>(`/api/hosts/door-staff/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.doorStaff }),
  });
}

// ── the door (Host and Door accounts) ──

/** Which venue and door this account scans for, and the party on now. Refreshes every 30 seconds. */
export function useDoorContext() {
  return useQuery({
    queryKey: keys.doorContext,
    queryFn: () => api.request<DoorContext>('/api/door/context'),
    refetchInterval: 30_000,
  });
}

/** Tonight's list for scanning with no signal. Refreshes every minute and is kept for a day. */
export function useDoorManifest(partyId: string | undefined) {
  return useQuery({
    queryKey: keys.doorManifest(partyId ?? ''),
    queryFn: () => api.request<DoorManifest>(`/api/door/manifest${query({ partyId })}`),
    enabled: !!partyId,
    refetchInterval: MINUTE,
    gcTime: DAY,
  });
}

function useScanned() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: keys.hostLive });
    client.invalidateQueries({ queryKey: keys.door });
  };
}

/**
 * Looks at a scanned pass without letting anyone in: who it is, how many are still outside and what to collect.
 * Fails with the same ApiError codes as `useCheckIn`. Show the result, then call `useCheckIn` with `admit`.
 * Changes nothing on the server, so it invalidates nothing.
 */
export function useCheckInPreview() {
  return useMutation({
    mutationFn: (code: string) => api.request<CheckInPreview>('/api/checkins/preview', { method: 'POST', body: { code } }),
  });
}

/**
 * Lets guests in at the door. `code` is the text read from the QR. `admit` lets in part of a group.
 * `clientScanId` (a uuid made on the phone) makes a repeated send count once.
 * Fails with ApiError codes `invalid_code`, `code_expired`, `already_used`, `hold_expired`, `booking_cancelled`,
 * `party_cancelled`, `party_over`, or kind `forbidden` for another venue's party.
 */
export function useCheckIn() {
  const onSuccess = useScanned();
  return useMutation({
    mutationFn: (input: { code: string; admit?: number; clientScanId?: string }) =>
      api.request<CheckInResult>('/api/checkins', { method: 'POST', body: input }),
    onSuccess,
  });
}

/** Sends scans made with no signal (100 at most). Each item comes back `admitted` or `refused` with its reason. */
export function useCheckInBatch() {
  const onSuccess = useScanned();
  return useMutation({
    mutationFn: (items: BatchScanItem[]) =>
      api.request<{ results: BatchScanResult[] }>('/api/checkins/batch', { method: 'POST', body: { items } }),
    onSuccess,
  });
}

/** Redeems a claimed perk from its QR text (`fmpc1...`). Fails with `invalid_code`, `claim_used`, `claim_expired`. */
export function useRedeemClaim() {
  return useMutation({
    mutationFn: (code: string) =>
      api.request<{ claimId: string; title: string; guestName: string; redeemedAt: string }>('/api/perk-claims/redeem', {
        method: 'POST',
        body: { code },
      }),
  });
}

// ── signs (hosts) ──

/** Everything the Promote tab shows for a week (`SignWeek.id`, e.g. "2026-W46"; default this week). */
export function useSignOptions(week?: string) {
  return useQuery({
    queryKey: keys.signOptions(week),
    queryFn: () => api.request<SignOptions>(`/api/hosts/signs/options${query({ week })}`),
  });
}

/** Books a sign; it waits for review. Fails with `spot_taken`, `slot_full`, `sign_limit`, `sign_invalid`. */
export function useBookSign() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SignInput) => api.request<SignBooking>('/api/hosts/signs', { method: 'POST', body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.hostSigns }),
  });
}

/** Cancels a sign that is in review, or approved and not yet up. Fails with `sign_running`. */
export function useCancelSign() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.request<void>(`/api/hosts/signs/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.hostSigns }),
  });
}

/** Uploads a sign's image from a local image URI; put the answer in `SignInput.artworkUrl`. Fails with `storage_off`. */
export function useUploadSignArtwork() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (imageUri: string) =>
      api.request<{ artworkUrl: string }>('/api/hosts/signs/artwork', { method: 'POST', body: imageFormData(imageUri) }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.hostSigns }),
  });
}

// ── platform admin ──

/** Signs by review status (default: waiting for review). */
export function useAdminSigns(status?: SignBooking['status']) {
  return useQuery({
    queryKey: keys.adminSignList(status),
    queryFn: () => api.request<AdminSign[]>(`/api/admin/signs${query({ status })}`),
  });
}

/** Approves a sign, or rejects it with a note for the host. */
export function useReviewSign() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; approve: true } | { id: string; approve: false; note: string }) =>
      input.approve
        ? api.request<void>(`/api/admin/signs/${input.id}/approve`, { method: 'POST' })
        : api.request<void>(`/api/admin/signs/${input.id}/reject`, { method: 'POST', body: { note: input.note } }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.adminSigns }),
  });
}

/** Reports by status (default: open). */
export function useAdminReports(status?: AdminReport['status']) {
  return useQuery({
    queryKey: keys.adminReportList(status),
    queryFn: () => api.request<AdminReport[]>(`/api/admin/reports${query({ status })}`),
  });
}

/** Closes a report: nothing more, switch the reported user's sharing off, or lock the account. */
export function useResolveReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: 'dismiss' | 'suspendSharing' | 'ban' }) =>
      api.request<void>(`/api/admin/reports/${input.id}/resolve`, { method: 'POST', body: { action: input.action } }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.adminReports }),
  });
}
