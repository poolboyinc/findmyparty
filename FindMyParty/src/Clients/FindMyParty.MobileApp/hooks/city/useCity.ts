import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  filterIsOn,
  filterVenues,
  friendsPulse,
  holdsLivePass,
  layerFromParam,
  livePulse,
  minePulse,
  NO_FILTER,
  walkTail,
  type MapFilter,
  type Pulse,
} from '@/components/city/city-lines';
import { CITY, SHEET_CUSHION, SHEET_HEIGHT_GUESS, type LngLat } from '@/components/city/constants';
import { turnText, type TurnStep } from '@/components/city/directions';
import { metresBetween, nearestVenueId, type CityMode } from '@/components/city/geojson';
import {
  useFriendsOut,
  useGlow,
  useMyBookings,
  useParty,
  useProfile,
  useSigns,
  useVenues,
} from '@/hooks/queries';
import { useHomeCity } from '@/hooks/useHomeCity';
import { layout, spacing } from '@/theme';
import type { Booking, MapSign, VenueSummary } from '@/types/api';
import { useCityCamera } from './useCityCamera';
import { useCityLocation } from './useCityLocation';
import { useWalkingRoute } from './useWalkingRoute';

export type { Pulse } from '@/components/city/city-lines';

const NO_VENUES: readonly VenueSummary[] = [];
const NO_BOOKINGS: readonly Booking[] = [];
const NO_SIGNS: readonly MapSign[] = [];
const NO_STEPS: readonly TurnStep[] = [];
const NO_TASTE: readonly string[] = [];
const NO_IDS: readonly string[] = [];

/** Something to tell the user in a banner. The venue is kept so "Try again" can try again. */
type Notice =
  | { kind: 'location-off' }
  | { kind: 'no-position' }
  | { kind: 'route-no-position'; venue: VenueSummary }
  | { kind: 'route-failed'; venue: VenueSummary };

export type Banner = { message: string; action?: { label: string; onPress: () => void } };

/** A banner goes away by itself after this long. */
const NOTICE_MS = 8000;
/** Tapping your own dot selects a venue you are standing at, if one is this close. */
const AT_VENUE_M = 60;
/** What the walking sheet's height is taken to be (above the home indicator) until it has been measured. */
const ROUTE_SHEET_GUESS = 170;
/** Room the sign's card takes at the bottom, so the camera keeps the sign above it. */
const SIGN_SHEET_ROOM = 300;
/** Room the title takes below the status bar, for framing the route. */
const HEADER_ROOM = 110;
const ROUTE_SIDE_ROOM = 56;
/** Your position is passed on only when it has moved this far, so the screen does not redraw at every step. */
const MOVE_STEP_M = 12;
/** Within this distance of a manoeuvre, the banner moves on to the next one. */
const TURN_REACHED_M = 20;
/** A city further than this from where the camera is gets a flight there. */
const NEW_CITY_M = 2000;
/** How often the walking card's "doors open" is looked at again. */
const CLOCK_MS = 30_000;

/** "herceg-novi" → "Herceg Novi": the city's name until the server's list has loaded. */
function nameFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

type Params = { walkTo?: string | string[]; venue?: string | string[]; layer?: string | string[] };

function one(value: string | string[] | undefined): string | null {
  const text = Array.isArray(value) ? value[0] : value;
  return text ? text : null;
}

/**
 * Everything the City tab does, so the screen file is only layout: the chosen city and its pulse,
 * the venues (filtered) and which one is selected, the three layers, signs, the camera, location,
 * the walking route, the route params (`walkTo`, `venue`, `layer`), and the banners that explain
 * a failure.
 */
export function useCity() {
  const insets = useSafeAreaInsets();
  const home = useHomeCity();
  const { slug, city } = home;
  const venuesQuery = useVenues(slug);
  const { data: bookingsData } = useMyBookings();
  const glowQuery = useGlow();
  const { data: profile } = useProfile();
  const { data: signsData } = useSigns(slug);
  const allVenues = venuesQuery.data ?? NO_VENUES;
  const bookings = bookingsData ?? NO_BOOKINGS;
  const signs = signsData ?? NO_SIGNS;

  const homeCenter = useMemo<LngLat>(
    () => (city ? [city.longitude, city.latitude] : CITY.center),
    [city],
  );
  const camera = useCityCamera(homeCenter);
  const location = useCityLocation();
  const walk = useWalkingRoute();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSignId, setSelectedSignId] = useState<string | null>(null);
  const lastSelectAt = useRef(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [asking, setAsking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mode, setModeState] = useState<CityMode>('live');
  const [filter, setFilter] = useState<MapFilter>(NO_FILTER);
  /** Where the user was last seen, updated every MOVE_STEP_M metres. */
  const [userAt, setUserAt] = useState<LngLat | null>(null);
  /** Which of the route's steps is the next manoeuvre. */
  const [stepIndex, setStepIndex] = useState(1);
  const [routeSheetHeight, setRouteSheetHeight] = useState<number | null>(null);

  /** The venue sheet's height as last measured; the camera keeps this much free under a beam. */
  const sheetHeight = useRef(SHEET_HEIGHT_GUESS);
  /** A walk asked for before location was allowed; it starts once the user allows it. */
  const pendingWalk = useRef<VenueSummary | null>(null);

  /** Bottom padding for anything that sits above the floating tab bar. */
  const tabBarClearance =
    insets.bottom + layout.floatingTabBarHeight + layout.floatingTabBarBottomOffset + spacing.base;
  /** The walking sheet covers the bottom of the screen, tab bar included. */
  const routeInset = routeSheetHeight ?? insets.bottom + ROUTE_SHEET_GUESS;

  // ── The city ──────────────────────────────────────────────────────────────

  // Another city was chosen (the city sheet, or the account changed it): fly there and start over.
  const { goTo } = camera;
  const { end: endWalk } = walk;
  const shownCenter = useRef<LngLat>(homeCenter);
  const mapReady = camera.initial !== null;
  useEffect(() => {
    if (!mapReady) return;
    if (metresBetween(shownCenter.current, homeCenter) < NEW_CITY_M) return;
    shownCenter.current = homeCenter;
    setSelectedId(null);
    setSelectedSignId(null);
    endWalk();
    goTo(homeCenter);
  }, [mapReady, homeCenter, goTo, endWalk]);

  const cityName = city?.name ?? nameFromSlug(slug);

  // ── Filter ────────────────────────────────────────────────────────────────

  const taste = profile?.taste ?? NO_TASTE;
  const venues = useMemo(
    () => filterVenues(allVenues, filter, taste, selectedId),
    [allVenues, filter, taste, selectedId],
  );

  // ── Selection ─────────────────────────────────────────────────────────────

  const selected = useMemo(
    () => (selectedId ? (allVenues.find((venue) => venue.id === selectedId) ?? null) : null),
    [allVenues, selectedId],
  );
  const partyQuery = useParty(selected?.partyId ?? undefined);
  const selectedParty = selected?.partyId && partyQuery.data?.id === selected.partyId ? partyQuery.data : null;

  const { focus } = camera;
  const select = useCallback(
    (venueId: string) => {
      const venue = allVenues.find((candidate) => candidate.id === venueId);
      if (!venue) return;
      Haptics.selectionAsync();
      lastSelectAt.current = Date.now();
      setSelectedSignId(null);
      setSelectedId(venueId);
      focus([venue.longitude, venue.latitude], sheetHeight.current + SHEET_CUSHION);
    },
    [allVenues, focus],
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

  const { refocus } = camera;
  const onSheetHeight = useCallback(
    (height: number) => {
      sheetHeight.current = height;
      refocus(height + SHEET_CUSHION);
    },
    [refocus],
  );

  const selectNearUser = useCallback(
    (at: LngLat) => {
      const venueId = nearestVenueId(allVenues, at, AT_VENUE_M);
      if (venueId) select(venueId);
    },
    [allVenues, select],
  );

  // ── Signs (S-19) ──────────────────────────────────────────────────────────

  const selectedSign = useMemo(
    () => (selectedSignId ? (signs.find((sign) => sign.id === selectedSignId) ?? null) : null),
    [signs, selectedSignId],
  );

  const selectSign = useCallback(
    (signId: string) => {
      const sign = signs.find((candidate) => candidate.id === signId);
      if (!sign) return;
      Haptics.selectionAsync();
      lastSelectAt.current = Date.now();
      setSelectedId(null);
      setSelectedSignId(signId);
      focus([sign.spot.longitude, sign.spot.latitude], SIGN_SHEET_ROOM);
    },
    [signs, focus],
  );

  const clearSign = useCallback(() => setSelectedSignId(null), []);

  /** "Stara Varoš": the spot's own area, else the area of the venue nearest to it. */
  const signArea = useMemo(() => {
    if (!selectedSign) return '';
    if (selectedSign.spot.area) return selectedSign.spot.area;
    const at: LngLat = [selectedSign.spot.longitude, selectedSign.spot.latitude];
    let best: { area: string; metres: number } | null = null;
    for (const venue of allVenues) {
      if (!venue.area) continue;
      const metres = metresBetween(at, [venue.longitude, venue.latitude]);
      if (!best || metres < best.metres) best = { area: venue.area, metres };
    }
    return best?.area ?? '';
  }, [selectedSign, allVenues]);

  // With nothing selected, the camera keeps room only for the walking sheet, if there is one.
  // This is also what gives the padding back when a sheet is dismissed.
  const walking = walk.state.status !== 'idle';
  const nothingSelected = selected === null && selectedSign === null;
  const { release } = camera;
  useEffect(() => {
    if (nothingSelected) release(walking ? routeInset : 0);
  }, [nothingSelected, walking, routeInset, release]);

  // ── Live / My City / Friends ──────────────────────────────────────────────

  const glow = glowQuery.data;
  const litIds = glow?.venuesLitIds ?? NO_IDS;
  const earned = useMemo<ReadonlySet<string>>(() => new Set(litIds), [litIds]);

  const friendsQuery = useFriendsOut(mode === 'friends' ? slug : undefined);
  const friendsOut = friendsQuery.data;

  const pulse = useMemo<Pulse | null>(() => {
    if (mode === 'friends') return friendsPulse(friendsOut);
    if (mode === 'mine') {
      if (!glow) return null;
      const explorer = glow.badges.find((badge) => badge.id === 'explorer') ?? null;
      return minePulse({
        litIds,
        cityVenueIds: venuesQuery.data ? venuesQuery.data.map((venue) => venue.id) : null,
        venueCount: city?.venueCount ?? null,
        explorer,
      });
    }
    return livePulse(city);
  }, [mode, friendsOut, glow, litIds, venuesQuery.data, city]);

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
  const routeInsetRef = useRef(routeInset);
  routeInsetRef.current = routeInset;

  /** Position, then route, then frame it. Location permission must already be granted. */
  const runWalk = useCallback(
    async (venue: VenueSummary) => {
      setNotice(null);
      setSelectedId(null);
      setSelectedSignId(null);
      const outcome = await start(venue, getPosition);
      if (outcome.result === 'ready') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fitBounds(outcome.route.ne, outcome.route.sw, { top: headerInset, bottom: routeInsetRef.current, side: ROUTE_SIDE_ROOM });
      } else if (outcome.result === 'no-position') {
        setNotice({ kind: 'route-no-position', venue });
      } else if (outcome.result === 'failed') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setNotice({ kind: 'route-failed', venue });
      }
    },
    [start, getPosition, fitBounds, headerInset],
  );

  /** The walking button on the venue sheet, and `walkTo` from another screen. */
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

  // "doors open" changes with the clock; look again now and then while walking.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!walking) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, [walking]);

  const walkVenueId = walk.state.status === 'idle' ? null : walk.state.venue.id;
  // The latest copy of the venue: its party may have changed since the walk started.
  const walkVenue = useMemo(() => {
    if (walk.state.status === 'idle') return null;
    return allVenues.find((venue) => venue.id === walkVenueId) ?? walk.state.venue;
  }, [walk.state, allVenues, walkVenueId]);
  const passReady = walkVenue ? holdsLivePass(bookings, walkVenue.partyId, now) : false;
  const routeTail = walkVenue
    ? walkTail(walkVenue.partyId ? { startsAt: walkVenue.partyStartsAt, endsAt: walkVenue.partyEndsAt } : null, passReady, now)
    : '';

  const onRouteSheetHeight = useCallback((height: number) => {
    setRouteSheetHeight((last) => (last !== null && Math.abs(last - height) < 1 ? last : height));
  }, []);

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

  // ── Route params: walkTo, venue, layer (BUILD-3-SPEC §3.5) ────────────────

  const params = useLocalSearchParams<Params>();
  const walkParam = one(params.walkTo);
  const venueParam = one(params.venue);
  const layerParam = layerFromParam(params.layer);
  const venuesLoaded = venuesQuery.data !== undefined;

  useEffect(() => {
    if (!layerParam) return;
    setModeState(layerParam);
    router.setParams({ layer: undefined });
  }, [layerParam]);

  // A param is handled once; it is also cleared, and a later link with the same id comes in after that.
  const handledVenue = useRef<string | null>(null);
  useEffect(() => {
    if (!venueParam) {
      handledVenue.current = null;
      return;
    }
    if (handledVenue.current === venueParam || !venuesLoaded || !mapReady) return;
    handledVenue.current = venueParam;
    router.setParams({ venue: undefined });
    if (allVenues.some((venue) => venue.id === venueParam)) select(venueParam);
    // Not on this city's map: its own page says what is on.
    else router.push(`/venue/${venueParam}`);
  }, [venueParam, venuesLoaded, mapReady, allVenues, select]);

  const handledWalk = useRef<string | null>(null);
  useEffect(() => {
    if (!walkParam) {
      handledWalk.current = null;
      return;
    }
    if (handledWalk.current === walkParam || !venuesLoaded || !mapReady || permission === 'checking') return;
    handledWalk.current = walkParam;
    router.setParams({ walkTo: undefined });
    const venue = allVenues.find((candidate) => candidate.id === walkParam);
    if (venue) walkTo(venue);
    else router.push(`/venue/${walkParam}`);
  }, [walkParam, venuesLoaded, mapReady, permission, allVenues, walkTo]);

  // ── Banners ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const { openSettings } = location;
  const banner = useMemo<Banner | null>(() => {
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

  const { refetch: refetchVenues } = venuesQuery;
  const retryVenues = useCallback(() => {
    refetchVenues();
  }, [refetchVenues]);

  /** The layer on screen could not load what it shows: say so, with "Try again". */
  const { refetch: refetchGlow } = glowQuery;
  const { refetch: refetchFriends } = friendsQuery;
  const layerError =
    mode === 'mine' && glowQuery.isError && !glow
      ? { error: glowQuery.error, retry: () => void refetchGlow() }
      : mode === 'friends' && friendsQuery.isError && !friendsOut
        ? { error: friendsQuery.error, retry: () => void refetchFriends() }
        : null;

  return {
    camera,
    tabBarClearance,

    slug,
    cityName,
    /** The city sheet's choice is stored by the sheet itself (`useHomeCity().setCity`); the map follows. */
    pulse,
    mode,
    setMode,
    earned,
    /** Friends layer: who is at which venue, and whether the user shares at all. */
    friendsOnMap: mode === 'friends' && friendsOut?.sharing ? friendsOut.venues : undefined,
    showFriendsOff: mode === 'friends' && friendsOut !== undefined && !friendsOut.sharing,
    layerError,

    /** The venues on the map: the city's, through the filter. */
    venues,
    filter,
    setFilter,
    filterOn: filterIsOn(filter),
    /** Set when loading venues failed, also when older venues are still on the map. */
    venuesError: venuesQuery.isError ? venuesQuery.error : null,
    retryVenues,

    selected,
    /** The selected venue's party in full (poster, sold out, checkout), once loaded. */
    selectedParty,
    selectedPartyLoading: !!selected?.partyId && partyQuery.isLoading,
    select,
    clearSelection,
    pressMap,
    selectNearUser,
    onSheetHeight,
    /** Metres from you to the selected venue, when your position is known. */
    selectedDistance,

    signs,
    selectedSign,
    signArea,
    selectSign,
    clearSign,

    route: walk.state,
    walkTo,
    endWalk: walk.end,
    nextTurn,
    /** What follows "To Monkey" on the walking sheet. */
    routeTail,
    /** You hold a pass for the party at the venue you are walking to. */
    passReady,
    onRouteSheetHeight,

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
