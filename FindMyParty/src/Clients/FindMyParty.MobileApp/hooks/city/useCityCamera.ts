import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Camera, CameraPadding, CameraStop } from '@rnmapbox/maps';
import { useReducedMotion } from '@/components/afterglow/motion';
import { CAMERA, CITY, DROP_DAY_KEY, SWITCH, type LngLat } from '@/components/city/constants';

/** The tilted city view. The camera rests here, and comes back here from 2D. */
export const DEFAULT_CAMERA: CameraStop = {
  centerCoordinate: CITY.center,
  zoomLevel: CAMERA.zoom,
  pitch: CAMERA.pitch,
  heading: CAMERA.heading,
};

/** Where the first open of the day starts: straight above the city and further out. */
const DROP_START: CameraStop = {
  centerCoordinate: CITY.center,
  zoomLevel: CAMERA.zoom - CAMERA.drop.zoomOut,
  pitch: CAMERA.drop.pitch,
  heading: CAMERA.drop.heading,
};

/** "2026-11-10" in the phone's own time. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Once known for this run of the app, the answer is kept here, so a remount does not wait. */
let dropDecided: boolean | null = null;

/** Asked once per run of the app, however often the screen mounts. */
let firstOpenAsked: Promise<boolean> | null = null;

/** True the first time the map opens on a given day; records the day. Never throws. */
function firstOpenToday(): Promise<boolean> {
  firstOpenAsked ??= readAndRecordDay();
  return firstOpenAsked;
}

async function readAndRecordDay(): Promise<boolean> {
  try {
    const day = today();
    const last = await AsyncStorage.getItem(DROP_DAY_KEY);
    if (last === day) return false;
    await AsyncStorage.setItem(DROP_DAY_KEY, day);
    return true;
  } catch {
    return false;
  }
}

/** A measured sheet height closer than this to the assumed one is not worth a second move. */
const REFOCUS_FROM = 12;

function paddingWithBottom(bottom: number): CameraPadding {
  return { paddingTop: 0, paddingRight: 0, paddingBottom: bottom, paddingLeft: 0 };
}

/**
 * The one owner of the map camera: centre, zoom, pitch, heading and padding.
 *
 * `<Camera>` gets only `ref` and `defaultSettings` (`initial`) from here; every later move is an imperative
 * `setCamera` through the ref, so no property is ever driven both ways.
 *
 * Every move sends the padding too. The native camera treats padding that is left out as zero,
 * so a move without it would drop the room kept for an open sheet.
 */
export function useCityCamera(home: LngLat = CITY.center) {
  const ref = useRef<Camera>(null);
  /** The city the map first opened on. */
  const firstHome = useRef(home).current;
  const reduceMotion = useReducedMotion();
  /**
   * Whether this opening drops in from above. Null until known: the map waits for it (a read of
   * one stored day, a few milliseconds), so the camera never has to jump.
   */
  const [drop, setDrop] = useState<boolean | null>(dropDecided === null ? null : false);
  /** Flat is 2D: looking straight down, north up. */
  const [flat, setFlatState] = useState(false);
  const flatRef = useRef(false);
  const bottomInset = useRef(0);
  /** The venue the camera was last sent to, while it is still selected. */
  const focused = useRef<LngLat | null>(null);
  /** Until this time, pitch reported by the map is ignored: our own tilt animation is running. */
  const ignorePitchUntil = useRef(0);
  /** The map laid itself flat because it was zoomed far out; it tilts back up when zoomed in again. */
  const flattenedByZoom = useRef(false);

  useEffect(() => {
    if (drop !== null) return;
    let alive = true;
    const wanted = SWITCH.cameraDrop && !reduceMotion;
    firstOpenToday().then((first) => {
      const result = wanted && first;
      dropDecided = result;
      // Until the drop has run, the pitch the map reports (straight down) is not the user's choice.
      if (result) ignorePitchUntil.current = Date.now() + 15_000;
      if (alive) setDrop(result);
    });
    return () => {
      alive = false;
    };
  }, [drop, reduceMotion]);

  const move = useCallback((stop: CameraStop) => {
    ref.current?.setCamera({
      animationMode: 'easeTo',
      animationDuration: CAMERA.focusMs,
      padding: paddingWithBottom(bottomInset.current),
      ...stop,
    });
  }, []);

  const setFlat = useCallback((next: boolean) => {
    flatRef.current = next;
    setFlatState(next);
  }, []);

  /** Tilt down flat facing north, or back up to the city view. */
  const tilt = useCallback(
    (toFlat: boolean) => {
      setFlat(toFlat);
      ignorePitchUntil.current = Date.now() + CAMERA.tiltMs + 400;
      move({
        pitch: toFlat ? 0 : CAMERA.pitch,
        heading: toFlat ? 0 : CAMERA.heading,
        animationDuration: CAMERA.tiltMs,
      });
    },
    [move, setFlat],
  );

  /** The 2D/3D control. */
  const toggleFlat = useCallback(() => {
    flattenedByZoom.current = false;
    tilt(!flatRef.current);
  }, [tilt]);

  /**
   * Called when the map comes to rest, with what it really shows.
   *  - Zoomed far out, the city lays itself flat (there are no buildings to stand beams on);
   *    zoomed back in, it tilts up again, unless the user chose 2D themselves.
   *  - If the user tilted the map by hand, the 2D/3D control and the beams follow.
   */
  const syncView = useCallback(
    (pitch: number, zoom: number) => {
      if (Date.now() < ignorePitchUntil.current) return;
      if (!flatRef.current && zoom < CAMERA.flattenBelowZoom) {
        flattenedByZoom.current = true;
        tilt(true);
        return;
      }
      if (flatRef.current && flattenedByZoom.current && zoom > CAMERA.tiltAgainAboveZoom) {
        flattenedByZoom.current = false;
        tilt(false);
        return;
      }
      if (!flatRef.current && pitch < CAMERA.flatBelowPitch) {
        flattenedByZoom.current = false;
        setFlat(true);
      } else if (flatRef.current && !flattenedByZoom.current && pitch > CAMERA.tiltedAbovePitch) {
        setFlat(false);
      }
    },
    [setFlat, tilt],
  );

  /**
   * The map has loaded. On the first open of the day the camera falls from straight above into
   * the tilted city (the mock's opening). The 2D/3D control ignores the pitch on the way down.
   */
  const onMapLoaded = useCallback(() => {
    if (!drop) return;
    ignorePitchUntil.current = Date.now() + CAMERA.drop.ms + 600;
    move({ ...DEFAULT_CAMERA, centerCoordinate: firstHome, animationMode: 'easeTo', animationDuration: CAMERA.drop.ms });
  }, [drop, move, firstHome]);

  /** Locate-me: fly to a coordinate, close in. */
  const flyTo = useCallback(
    (center: LngLat) => {
      focused.current = null;
      move({
        centerCoordinate: center,
        zoomLevel: CAMERA.locateZoom,
        animationMode: 'flyTo',
        animationDuration: CAMERA.flyMs,
      });
    },
    [move],
  );

  /** Ease to a venue, keeping `inset` points free at the bottom so its beam shows above the sheet. */
  const focus = useCallback(
    (center: LngLat, inset: number) => {
      focused.current = center;
      bottomInset.current = inset;
      move({ centerCoordinate: center });
    },
    [move],
  );

  /**
   * The sheet turned out taller or shorter than assumed: ease to the same venue again with the
   * right room. The centre is sent again because a new move stops the one still running.
   */
  const refocus = useCallback(
    (inset: number) => {
      if (!focused.current || Math.abs(inset - bottomInset.current) < REFOCUS_FROM) return;
      bottomInset.current = inset;
      move({ centerCoordinate: focused.current });
    },
    [move],
  );

  /** Nothing is selected any more: keep only `inset` points free at the bottom (0 for none). */
  const release = useCallback(
    (inset: number) => {
      focused.current = null;
      if (Math.abs(inset - bottomInset.current) < 1) return;
      bottomInset.current = inset;
      move({});
    },
    [move],
  );

  /** Show a whole route: fit its bounding box between the header and whatever covers the bottom. */
  const fitBounds = useCallback(
    (ne: LngLat, sw: LngLat, insets: { top: number; bottom: number; side: number }) => {
      focused.current = null;
      bottomInset.current = insets.bottom;
      move({
        bounds: { ne, sw },
        padding: {
          paddingTop: insets.top,
          paddingRight: insets.side,
          paddingBottom: insets.bottom,
          paddingLeft: insets.side,
        },
        animationDuration: CAMERA.routeMs,
      });
    },
    [move],
  );

  /** Another city was chosen: fly to its middle, back at the resting zoom. */
  const goTo = useCallback(
    (center: LngLat) => {
      focused.current = null;
      move({ centerCoordinate: center, zoomLevel: CAMERA.zoom, animationMode: 'flyTo', animationDuration: CAMERA.flyMs });
    },
    [move],
  );

  /**
   * Given to `<Camera defaultSettings>` once the drop is decided; never changed afterwards, so it
   * looks at the city that was chosen when the map first opened (`goTo` moves it later).
   */
  const initial = useMemo(
    () => (drop === null ? null : { ...(drop ? DROP_START : DEFAULT_CAMERA), centerCoordinate: firstHome }),
    [drop, firstHome],
  );

  return useMemo(
    () => ({ ref, initial, flat, toggleFlat, syncView, onMapLoaded, goTo, flyTo, focus, refocus, release, fitBounds }),
    [initial, flat, toggleFlat, syncView, onMapLoaded, goTo, flyTo, focus, refocus, release, fitBounds],
  );
}

export type CityCamera = ReturnType<typeof useCityCamera>;
