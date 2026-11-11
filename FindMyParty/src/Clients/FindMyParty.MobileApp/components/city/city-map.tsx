import { memo, type ComponentProps, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LineString } from 'geojson';
import { Camera, MapView } from '@rnmapbox/maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CityCamera } from '@/hooks/city/useCityCamera';
import { colors, layout, spacing } from '@/theme';
import type { VenueSummary } from '@/types/api';
import { CityStyle } from './city-style';
import { LAYER, MAP_STYLE_URL, type LngLat } from './constants';
import { venueOfBuilding } from './footprint';
import type { CityMode } from './geojson';
import { RouteLayer } from './route-layer';
import { UserDot } from './user-dot';
import { VenueLayers } from './venue-layers';
import { useVenueFootprints } from '@/hooks/city/useVenueFootprints';

type MapState = Parameters<NonNullable<ComponentProps<typeof MapView>['onMapIdle']>>[0];
type MapPress = Parameters<NonNullable<ComponentProps<typeof MapView>['onPress']>>[0];

type Props = {
  camera: CityCamera;
  venues: readonly VenueSummary[];
  selectedId: string | null;
  /** Live, or My City. */
  mode: CityMode;
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
  const { footprints, scan } = useVenueFootprints();
  const { syncView } = camera;
  const handleIdle = useCallback(
    (state: MapState) => {
      syncView(state.properties.pitch, state.properties.zoom);
      // Once the buildings are drawn, find each venue's own building so its roof lights up.
      void scan(mapRef.current, venues);
    },
    [syncView, scan, venues],
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
      <VenueLayers
        venues={venues}
        selectedId={selectedId}
        flat={camera.flat}
        mode={mode}
        earned={earned}
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
