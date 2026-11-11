import { memo, type ComponentProps, useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LineString } from 'geojson';
import { Camera, MapView } from '@rnmapbox/maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CityCamera } from '@/hooks/city/useCityCamera';
import { colors, layout, spacing } from '@/theme';
import { CityStyle } from './city-style';
import { LAYER, MAP_STYLE_URL, type LngLat } from './constants';
import { venueOfBuilding } from './footprint';
import type { CityMode, FriendsOnMap, VenueOnMap } from './geojson';
import { RouteLayer } from './route-layer';
import { SignLayers } from './sign-layers';
import { signsInView, type SignOnMap } from './signs';
import { UserDot } from './user-dot';
import { VenueLayers } from './venue-layers';
import { useVenueFootprints } from '@/hooks/city/useVenueFootprints';

type MapState = Parameters<NonNullable<ComponentProps<typeof MapView>['onMapIdle']>>[0];
type MapPress = Parameters<NonNullable<ComponentProps<typeof MapView>['onPress']>>[0];

type Props = {
  camera: CityCamera;
  venues: readonly VenueOnMap[];
  selectedId: string | null;
  /** Live, My City, or Friends. */
  mode: CityMode;
  /** Friends layer: who is at which venue (`FriendsOut.venues` as it comes). */
  friends?: readonly FriendsOnMap[];
  /** The city's signs, in the server's order (`MapSign[]` as it comes). The map draws the few in view. */
  signs?: readonly SignOnMap[];
  /** A sign was tapped. */
  onSelectSign?: (signId: string) => void;
  /** My City: the venues the user has been scanned into. */
  earned: ReadonlySet<string>;
  onSelectVenue: (venueId: string) => void;
  /** A tap that hit no venue. */
  onPressEmpty: () => void;
  routeLine: LineString | null;
  /** Draw the user's position. Only ever true once location permission is granted. */
  showUser: boolean;
  onPressUser: (at: LngLat) => void;
  /** Each new position of the user. */
  onUserMove: (at: LngLat) => void;
  /** The screen is in front of the user: busy venues may pulse. */
  pulse?: boolean;
};

const NO_SIGNS: readonly SignOnMap[] = [];
/** The design allows this many signs in view at once. */
const SIGNS_IN_VIEW = 3;

/** Left edge of the Mapbox wordmark, and of the "i" button beside it. */
const LOGO_LEFT = spacing.base;
const ATTRIBUTION_LEFT = LOGO_LEFT + 96;

/**
 * The map itself: Mapbox's dark-v11 repainted as the mock's violet city (city-style.tsx), the route,
 * the venues as beams, and you. Layers are mounted bottom to top: city, route, venues, user dot.
 *
 * The Mapbox wordmark and the attribution button stay on, as Mapbox's terms require, and sit
 * at the bottom left just above the tab bar.
 */
export const CityMap = memo(function CityMap({
  camera,
  venues,
  selectedId,
  mode,
  earned,
  friends,
  signs = NO_SIGNS,
  onSelectSign,
  onSelectVenue,
  onPressEmpty,
  routeLine,
  showUser,
  onPressUser,
  onUserMove,
  pulse = false,
}: Props) {
  const insets = useSafeAreaInsets();

  // Clear of the floating tab bar. The bottom inset is added in case the map measures from the
  // screen edge rather than from the safe area; either way the marks end up above the bar.
  const ornaments = useMemo(() => {
    const bottom = insets.bottom + layout.floatingTabBarHeight + layout.floatingTabBarBottomOffset + spacing.sm;
    return {
      logo: { bottom, left: LOGO_LEFT },
      attribution: { bottom, left: ATTRIBUTION_LEFT },
    };
  }, [insets.bottom]);

  const mapRef = useRef<MapView>(null);
  const { footprints, scan } = useVenueFootprints(venues);
  const { syncView } = camera;
  // The part of the city on screen, kept from the last time the map came to rest: it decides
  // which signs are drawn.
  const [view, setView] = useState<{ west: number; south: number; east: number; north: number } | null>(null);
  const shownSigns = useMemo(() => signsInView(signs, view, SIGNS_IN_VIEW), [signs, view]);

  const handleIdle = useCallback(
    (state: MapState) => {
      syncView(state.properties.pitch, state.properties.zoom);
      // Once the buildings are drawn, find each venue's own building so its roof lights up.
      void scan(mapRef.current);
      const { ne, sw } = state.properties.bounds;
      if (ne && sw) setView({ west: sw[0], south: sw[1], east: ne[0], north: ne[1] });
    },
    [syncView, scan],
  );

  // A tap anywhere on a venue's own building (its walls, its roof) selects the venue, not only a
  // tap on its beam or its name: the map says which building is under the finger.
  const handlePress = useCallback(
    async (press: MapPress) => {
      const x: unknown = press.properties?.screenPointX;
      const y: unknown = press.properties?.screenPointY;
      if (typeof x === 'number' && typeof y === 'number' && mapRef.current) {
        try {
          const under = await mapRef.current.queryRenderedFeaturesAtPoint([x, y], [], [LAYER.buildings]);
          const venueId = venueOfBuilding(under?.features ?? [], footprints);
          if (venueId) {
            onSelectVenue(venueId);
            return;
          }
        } catch {
          // The map could not answer: treat it as a tap on nothing.
        }
      }
      onPressEmpty();
    },
    [footprints, onSelectVenue, onPressEmpty],
  );

  // The camera's first position depends on whether today's drop runs; known within a moment.
  if (!camera.initial) return <View style={styles.waiting} />;

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      styleURL={MAP_STYLE_URL}
      logoEnabled
      logoPosition={ornaments.logo}
      attributionEnabled
      attributionPosition={ornaments.attribution}
      compassEnabled={false}
      scaleBarEnabled={false}
      onPress={handlePress}
      onMapIdle={handleIdle}
      onDidFinishLoadingMap={camera.onMapLoaded}
    >
      <Camera ref={camera.ref} defaultSettings={camera.initial} />
      <CityStyle />
      <RouteLayer line={routeLine} />
      <SignLayers signs={camera.flat ? NO_SIGNS : shownSigns} onSelect={onSelectSign} />
      <VenueLayers
        venues={venues}
        selectedId={selectedId}
        flat={camera.flat}
        mode={mode}
        earned={earned}
        friends={friends}
        footprints={footprints}
        pulse={pulse}
        onSelect={onSelectVenue}
      />
      {showUser ? <UserDot onPress={onPressUser} onMove={onUserMove} /> : null}
    </MapView>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  waiting: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
