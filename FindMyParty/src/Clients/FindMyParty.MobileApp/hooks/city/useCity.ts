import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHEET_CUSHION, SHEET_HEIGHT_GUESS, type LngLat } from '@/components/city/constants';
import { nearestVenueId } from '@/components/city/geojson';
import { useParties, useVenues } from '@/hooks/queries';
import { layout, spacing } from '@/theme';
import type { VenueSummary } from '@/types/api';
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

/**
 * Everything the city screen does, so the screen file is only layout:
 * the venues and which one is selected, the camera, location, the walking route,
 * and the banners that explain a failure.
 */
export function useCity() {
  const insets = useSafeAreaInsets();
  const venuesQuery = useVenues();
  const { data: parties } = useParties();
  const venues = venuesQuery.data ?? NO_VENUES;

  const camera = useCityCamera();
  const location = useCityLocation();
  const walk = useWalkingRoute();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [asking, setAsking] = useState(false);
  const [locating, setLocating] = useState(false);

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
      setSelectedId(venueId);
      camera.focus([venue.longitude, venue.latitude], sheetHeight.current + SHEET_CUSHION);
    },
    [venues, camera],
  );

  const clearSelection = useCallback(() => setSelectedId(null), []);

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
    /** Venues with a live crowd; null until the first load has come back. */
    litCount: venuesQuery.data ? venuesQuery.data.filter((venue) => venue.crowdSource === 'live').length : null,
    /** Set when loading venues failed, also when older venues are still on the map. */
    venuesError: venuesQuery.isError ? venuesQuery.error : null,
    retryVenues,

    selected,
    selectedParty,
    select,
    clearSelection,
    selectNearUser,
    onSheetHeight,

    route: walk.state,
    walkTo,
    endWalk: walk.end,

    showUser: permission === 'granted',
    showLocationCard: location.shouldOffer,
    asking,
    allowLocation,
    notNow,
    locate,
    locating,

    banner,
  };
}
