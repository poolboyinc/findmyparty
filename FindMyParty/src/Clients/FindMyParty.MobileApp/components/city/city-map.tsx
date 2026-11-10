import { memo, useCallback, useMemo, type ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import type { LineString } from 'geojson';
import { Camera, MapView } from '@rnmapbox/maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_CAMERA, type CityCamera } from '@/hooks/city/useCityCamera';
import { layout, spacing } from '@/theme';
import type { VenueSummary } from '@/types/api';
import { CityStyle } from './city-style';
import { MAP_STYLE_URL, NIGHT_STYLE_JSON, USE_STANDARD_STYLE, type LngLat } from './constants';
import { RouteLayer } from './route-layer';
import { UserDot } from './user-dot';
import { VenueLayers } from './venue-layers';

type MapState = Parameters<NonNullable<ComponentProps<typeof MapView>['onMapIdle']>>[0];

type Props = {
  camera: CityCamera;
  venues: readonly VenueSummary[];
  selectedId: string | null;
  onSelectVenue: (venueId: string) => void;
  /** A tap that hit no venue. */
  onPressEmpty: () => void;
  routeLine: LineString | null;
  /** Draw the user's position. Only ever true once location permission is granted. */
  showUser: boolean;
  onPressUser: (at: LngLat) => void;
};

/** Left edge of the Mapbox wordmark, and of the "i" button beside it. */
const LOGO_LEFT = spacing.base;
const ATTRIBUTION_LEFT = LOGO_LEFT + 96;

/**
 * The map itself: Mapbox's city under the night light, the route, the venues as beams, and you.
 * Layers are mounted bottom to top: basemap settings, route, venue layers, user dot.
 *
 * The Mapbox wordmark and the attribution button stay on, as Mapbox's terms require, and sit
 * at the bottom left just above the tab bar.
 */
export const CityMap = memo(function CityMap({
  camera,
  venues,
  selectedId,
  onSelectVenue,
  onPressEmpty,
  routeLine,
  showUser,
  onPressUser,
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

  const { syncPitch } = camera;
  const handleIdle = useCallback((state: MapState) => syncPitch(state.properties.pitch), [syncPitch]);

  return (
    <MapView
      style={styles.map}
      {...(USE_STANDARD_STYLE ? { styleJSON: NIGHT_STYLE_JSON } : { styleURL: MAP_STYLE_URL })}
      logoEnabled
      logoPosition={ornaments.logo}
      attributionEnabled
      attributionPosition={ornaments.attribution}
      compassEnabled={false}
      scaleBarEnabled={false}
      onPress={onPressEmpty}
      onMapIdle={handleIdle}
    >
      <Camera ref={camera.ref} defaultSettings={DEFAULT_CAMERA} />
      <CityStyle />
      <RouteLayer line={routeLine} />
      <VenueLayers venues={venues} selectedId={selectedId} flat={camera.flat} onSelect={onSelectVenue} />
      {showUser ? <UserDot onPress={onPressUser} /> : null}
    </MapView>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
