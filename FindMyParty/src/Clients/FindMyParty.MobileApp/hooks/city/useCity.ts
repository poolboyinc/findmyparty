import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHEET_CUSHION, SHEET_HEIGHT_GUESS, type LngLat } from '@/components/city/constants';
import { turnText, type TurnStep } from '@/components/city/directions';
import { metresBetween, nearestVenueId, type CityMode } from '@/components/city/geojson';
import { useMyBookings, useParties, useVenues } from '@/hooks/queries';
import { layout, spacing } from '@/theme';
import type { Booking, VenueSummary } from '@/types/api';
import { useCityCamera } from './useCityCamera';
import { useCityLocation } from './useCityLocation';
import { useWalkingRoute } from './useWalkingRoute';

const NO_VENUES: readonly VenueSummary[] = [];

/** Something to tell the user in a banner. The venue is kept so "Try again" can try again. */
type Notice =
  | { kind: 'location-off' }
  | { kind: 'no-position' }
  | { kind: 'route-no-position'; venue: VenueSummary }
  | { kind: 'route-failed'; venue: VenueSummary };

/** A banner goes away by itself after this long. */
const NOTICE_MS = 8000;
/** Tapping your own dot selects a venue you are standing at, if one is this close. */
const AT_VENUE_M = 60;
/** Room the route card takes above the tab bar, for framing the route. */
const ROUTE_CARD_ROOM = 132;
/** Room the title takes below the status bar, for framing the route. */
const HEADER_ROOM = 110;
const ROUTE_SIDE_ROOM = 56;
/** Your position is passed on only when it has moved this far, so the screen does not redraw at every step. */
const MOVE_STEP_M = 12;
/** Within this distance of a manoeuvre, the banner moves on to the next one. */
const TURN_REACHED_M = 20;

const NO_BOOKINGS: readonly Booking[] = [];
const NO_STEPS: readonly TurnStep[] = [];
/** The lowest number each crowd range stands for. */
const LEVEL_FLOOR: Record<string, number> = { quiet: 0, '20+': 20, '50+': 50, '100+': 100, '200+': 200 };

/** The line under the city's name: bold part and the rest, e.g. "1,200+" and " out tonight, 14 venues lit". */
export type Pulse = { strong: string; rest: string; tone: 'live' | 'earned' };

function thousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function venuesWord(n: number): string {
  return n === 1 ? '1 venue' : `${n} venues`;
}

/**
 * Live: at least how many people are out (the sum of the lowest number of each live range,
 * never an exact count) and how many venues are lit. My City: how many of the city's venues you lit.
 */
function pulseLine(venues: readonly VenueSummary[], mode: CityMode, earned: ReadonlySet<string>): Pulse | null {
  if (venues.length === 0) return null;
  if (mode === 'mine') {
    const lit = venues.filter((venue) => earned.has(venue.id)).length;
    return { strong: `${lit} of ${venues.length}`, rest: ' venues lit', tone: 'earned' };
  }
  const live = venues.filter((venue) => venue.crowdSource === 'live');
  const out = live.reduce((sum, venue) => sum + (LEVEL_FLOOR[venue.crowdLevel ?? ''] ?? 0), 0);
  if (live.length === 0) return { strong: '', rest: 'No venues lit yet', tone: 'live' };
  if (out === 0) return { strong: venuesWord(live.length), rest: ' lit', tone: 'live' };
  return { strong: `${thousands(out)}+`, rest: ` out tonight, ${venuesWord(live.length)} lit`, tone: 'live' };
}

/** Venues the user has been scanned into: a booking with someone let in at the door. */
function earnedVenues(bookings: readonly Booking[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const booking of bookings) {
    const venueId = booking.party?.venueId;
    if (booking.checkedInCount > 0 && venueId) ids.add(venueId);
  }
  return ids;
}

/** A pass the user holds for a party at this venue that has not ended. */
function holdsPass(bookings: readonly Booking[], venueId: string, now: number): boolean {
  return bookings.some(
    (booking) =>
      booking.status !== 'Cancelled' && booking.party?.venueId === venueId && Date.parse(booking.partyEndsAt) > now,
  );
}

/**
 * Everything the city screen does, so the screen file is only layout:
 * the venues and which one is selected, the camera, location, the walking route,
 * and the banners that explain a failure.
 */
export function useCity() {
  const insets = useSafeAreaInsets();
  const venuesQuery = useVenues();
  const { data: parties } = useParties();
  const { data: bookingsData } = useMyBookings();
  const venues = venuesQuery.data ?? NO_VENUES;
  const bookings = bookingsData ?? NO_BOOKINGS;

  const camera = useCityCamera();
  const location = useCityLocation();
  const walk = useWalkingRoute();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastSelectAt = useRef(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [asking, setAsking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mode, setModeState] = useState<CityMode>('live');
  /** Where the user was last seen, updated every MOVE_STEP_M metres. */
  const [userAt, setUserAt] = useState<LngLat | null>(null);
  /** Which of the route's steps is the next manoeuvre. */
  const [stepIndex, setStepIndex] = useState(1);

  /** The venue sheet's height as last measured; the camera keeps this much free under a beam. */
  const sheetHeight = useRef(SHEET_HEIGHT_GUESS);
  /** A walk asked for before location was allowed; it starts once the user allows it. */
  const pendingWalk = useRef<VenueSummary | null>(null);

  /** Bottom padding for anything that sits above the floating tab bar. */
  const tabBarClearance =
    insets.bottom + layout.floatingTabBarHeight + layout.floatingTabBarBottomOffset + spacing.base;
  const routeInset = tabBarClearance + ROUTE_CARD_ROOM;

  // ── Selection ─────────────────────────────────────────────────────────────

  const selected = useMemo(
    () => (selectedId ? (venues.find((venue) => venue.id === selectedId) ?? null) : null),
    [venues, selectedId],
  );
  const selectedParty = useMemo(() => {
    const partyId = selected?.partyId;
    return partyId ? (parties?.find((party) => party.id === partyId) ?? null) : null;
  }, [parties, selected]);

  const select = useCallback(
    (venueId: string) => {
      const venue = venues.find((candidate) => candidate.id === venueId);
      if (!venue) return;
      Haptics.selectionAsync();
      lastSelectAt.current = Date.now();
      setSelectedId(venueId);
      camera.focus([venue.longitude, venue.latitude], sheetHeight.current + SHEET_CUSHION);
    },
    [venues, camera],
  );

  const clearSelection = useCallback(() => setSelectedId(null), []);
  /**
   * A tap on empty map closes the sheet. The map also reports the tap that just selected a beam as a
   * map tap, so taps within a moment of a selection are ignored.
   */
  const pressMap = useCallback(() => {
    if (Date.now() - lastSelectAt.current < 400) return;
    setSelectedId(null);
  }, []);

  const onSheetHeight = useCallback(
    (height: number) => {
      sheetHeight.current = height;
      camera.refocus(height + SHEET_CUSHION);
    },
    [camera],
  );

  const selectNearUser = useCallback(
    (at: LngLat) => {
      const venueId = nearestVenueId(venues, at, AT_VENUE_M);
      if (venueId) select(venueId);
    },
    [venues, select],
  );

  // With nothing selected, the camera keeps room only for the route card, if there is one.
  // This is also what gives the padding back when the sheet is dismissed.
  const walking = walk.state.status !== 'idle';
  const nothingSelected = selected === null;
  const { release } = camera;
  useEffect(() => {
    if (nothingSelected) release(walking ? routeInset : 0);
  }, [nothingSelected, walking, routeInset, release]);

  // ── Live / My City ────────────────────────────────────────────────────────

  const earned = useMemo(() => earnedVenues(bookings), [bookings]);
  const pulse = useMemo(() => pulseLine(venues, mode, earned), [venues, mode, earned]);
  const setMode = useCallback(
    (next: CityMode) => {
      if (next === mode) return;
      Haptics.selectionAsync();
      setModeState(next);
    },
    [mode],
  );

  // ── You ───────────────────────────────────────────────────────────────────

  const onUserMove = useCallback((at: LngLat) => {
    setUserAt((last) => (last && metresBetween(last, at) < MOVE_STEP_M ? last : at));
  }, []);

  const selectedDistance = useMemo(
    () => (selected && userAt ? metresBetween(userAt, [selected.longitude, selected.latitude]) : null),
    [selected, userAt],
  );

  // ── Walking route ─────────────────────────────────────────────────────────

  const { permission, offerAgain, getPosition } = location;
  const { start } = walk;
  const { fitBounds } = camera;
  const headerInset = insets.top + HEADER_ROOM;

  /** Position, then route, then frame it. Location permission must already be granted. */
  const runWalk = useCallback(
    async (venue: VenueSummary) => {
      setNotice(null);
      setSelectedId(null);
      const outcome = await start(venue, getPosition);
      if (outcome.result === 'ready') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fitBounds(outcome.route.ne, outcome.route.sw, { top: headerInset, bottom: routeInset, side: ROUTE_SIDE_ROOM });
      } else if (outcome.result === 'no-position') {
        setNotice({ kind: 'route-no-position', venue });
      } else if (outcome.result === 'failed') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setNotice({ kind: 'route-failed', venue });
      }
    },
    [start, getPosition, fitBounds, headerInset, routeInset],
  );

  /** The walking button on the venue sheet. */
  const walkTo = useCallback(
    (venue: VenueSummary) => {
      if (permission === 'denied') {
        setNotice({ kind: 'location-off' });
      } else if (permission !== 'granted') {
        // Not asked yet: put the sheet away so the location card can be seen, and carry on after.
        pendingWalk.current = venue;
        setSelectedId(null);
        offerAgain();
      } else {
        runWalk(venue);
      }
    },
    [permission, offerAgain, runWalk],
  );

  // The next manoeuvre: step 0 is the start, so the first one to show is step 1. Reaching a
  // manoeuvre moves the banner on to the one after it.
  const steps: readonly TurnStep[] = walk.state.status === 'ready' ? walk.state.route.steps : NO_STEPS;
  useEffect(() => setStepIndex(1), [steps]);
  useEffect(() => {
    if (!userAt || stepIndex >= steps.length - 1) return;
    if (metresBetween(userAt, steps[stepIndex].at) <= TURN_REACHED_M) setStepIndex((index) => index + 1);
  }, [userAt, steps, stepIndex]);

  const nextTurn = useMemo(() => {
    if (walk.state.status !== 'ready' || steps.length < 2) return null;
    const step = steps[Math.min(stepIndex, steps.length - 1)];
    const from = userAt ?? steps[0].at;
    return { ...turnText(step, walk.state.venue.name), metres: metresBetween(from, step.at) };
  }, [walk.state, steps, stepIndex, userAt]);

  const walkVenueId = walk.state.status === 'idle' ? null : walk.state.venue.id;
  const passReady = useMemo(
    () => (walkVenueId ? holdsPass(bookings, walkVenueId, Date.now()) : false),
    [bookings, walkVenueId],
  );

  // ── Location ──────────────────────────────────────────────────────────────

  const { request, decline } = location;

  /** "Use my location" on the card: the only place the system prompt is shown from. */
  const allowLocation = useCallback(async () => {
    setAsking(true);
    const result = await request();
    setAsking(false);
    const venue = pendingWalk.current;
    pendingWalk.current = null;
    if (result === 'granted' && venue) runWalk(venue);
  }, [request, runWalk]);

  const notNow = useCallback(() => {
    pendingWalk.current = null;
    decline();
  }, [decline]);

  const { flyTo } = camera;
  const locate = useCallback(async () => {
    if (permission === 'denied') {
      setNotice({ kind: 'location-off' });
      return;
    }
    if (permission !== 'granted') {
      offerAgain();
      return;
    }
    setLocating(true);
    const at = await getPosition();
    setLocating(false);
    if (at) flyTo(at);
    else setNotice({ kind: 'no-position' });
  }, [permission, offerAgain, getPosition, flyTo]);

  // ── Banners ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const { openSettings } = location;
  const banner = useMemo(() => {
    if (!notice) return null;
    switch (notice.kind) {
      case 'location-off':
        return {
          message: 'Location is off for FindMyParty. Turn it on in Settings to see where you are and to get a route.',
          action: { label: 'Open Settings', onPress: openSettings },
        };
      case 'no-position':
        return { message: 'Could not find where you are. Try again in a moment.' };
      case 'route-no-position':
        return {
          message: 'Could not find where you are, so there is no route yet.',
          action: { label: 'Try again', onPress: () => walkTo(notice.venue) },
        };
      case 'route-failed':
        return {
          message: 'Could not get a route. Try again.',
          action: { label: 'Try again', onPress: () => walkTo(notice.venue) },
        };
    }
  }, [notice, openSettings, walkTo]);

  const { refetch } = venuesQuery;
  const retryVenues = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    camera,
    tabBarClearance,

    venues,
    mode,
    setMode,
    earned,
    /** The line under the city's name; null until the first load has come back. */
    pulse: venuesQuery.data ? pulse : null,
    /** Set when loading venues failed, also when older venues are still on the map. */
    venuesError: venuesQuery.isError ? venuesQuery.error : null,
    retryVenues,

    selected,
    selectedParty,
    select,
    clearSelection,
    pressMap,
    selectNearUser,
    onSheetHeight,
    /** Metres from you to the selected venue, when your position is known. */
    selectedDistance,

    route: walk.state,
    walkTo,
    endWalk: walk.end,
    nextTurn,
    /** You hold a pass for a party at the venue you are walking to. */
    passReady,

    showUser: permission === 'granted',
    onUserMove,
    showLocationCard: location.shouldOffer,
    asking,
    allowLocation,
    notNow,
    locate,
    locating,

    banner,
  };
}
