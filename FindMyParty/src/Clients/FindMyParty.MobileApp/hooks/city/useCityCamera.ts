import { useCallback, useMemo, useRef, useState } from 'react';
import type { Camera, CameraPadding, CameraStop } from '@rnmapbox/maps';
import { CAMERA, CITY, type LngLat } from '@/components/city/constants';

/** Where the camera starts. Given to `<Camera defaultSettings>` once; never changed afterwards. */
export const DEFAULT_CAMERA: CameraStop = {
  centerCoordinate: CITY.center,
  zoomLevel: CAMERA.zoom,
  pitch: CAMERA.pitch,
  heading: CAMERA.heading,
};

/** A measured sheet height closer than this to the assumed one is not worth a second move. */
const REFOCUS_FROM = 12;

function paddingWithBottom(bottom: number): CameraPadding {
  return { paddingTop: 0, paddingRight: 0, paddingBottom: bottom, paddingLeft: 0 };
}

/**
 * The one owner of the map camera: centre, zoom, pitch, heading and padding.
 *
 * `<Camera>` gets only `ref` and `defaultSettings` from here; every later move is an imperative
 * `setCamera` through the ref, so no property is ever driven both ways.
 *
 * Every move sends the padding too. The native camera treats padding that is left out as zero,
 * so a move without it would drop the room kept for an open sheet.
 */
export function useCityCamera() {
  const ref = useRef<Camera>(null);
  /** Flat is 2D: looking straight down, north up. */
  const [flat, setFlatState] = useState(false);
  const flatRef = useRef(false);
  const bottomInset = useRef(0);
  /** The venue the camera was last sent to, while it is still selected. */
  const focused = useRef<LngLat | null>(null);
  /** Until this time, pitch reported by the map is ignored: our own tilt animation is running. */
  const ignorePitchUntil = useRef(0);

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

  /** The 2D/3D control: tilt down flat facing north, or back up to the city view. */
  const toggleFlat = useCallback(() => {
    const next = !flatRef.current;
    setFlat(next);
    ignorePitchUntil.current = Date.now() + CAMERA.tiltMs + 400;
    move({
      pitch: next ? 0 : CAMERA.pitch,
      heading: next ? 0 : CAMERA.heading,
      animationDuration: CAMERA.tiltMs,
    });
  }, [move, setFlat]);

  /**
   * Called when the map comes to rest. If the user tilted it by hand, the 2D/3D control and the
   * beams follow what the map really shows.
   */
  const syncPitch = useCallback(
    (pitch: number) => {
      if (Date.now() < ignorePitchUntil.current) return;
      if (!flatRef.current && pitch < CAMERA.flatBelowPitch) setFlat(true);
      else if (flatRef.current && pitch > CAMERA.tiltedAbovePitch) setFlat(false);
    },
    [setFlat],
  );

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

  return useMemo(
    () => ({ ref, flat, toggleFlat, syncPitch, flyTo, focus, refocus, release, fitBounds }),
    [flat, toggleFlat, syncPitch, flyTo, focus, refocus, release, fitBounds],
  );
}

export type CityCamera = ReturnType<typeof useCityCamera>;
