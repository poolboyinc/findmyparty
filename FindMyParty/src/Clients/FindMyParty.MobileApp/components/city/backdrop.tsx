import { memo, useCallback, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Mapbox, { Camera, CircleLayer, MapView, ShapeSource } from '@rnmapbox/maps';
import { ApiConstants } from '@/constants/api';
import { useVenues } from '@/hooks/queries';
import { colors } from '@/theme';
import type { VenueSummary } from '@/types/api';
import { CityStyle } from './city-style';
import { BACKDROP_CAMERA, MAP_STYLE_URL } from './constants';
import { YOU_CENTRE_STYLE, YOU_DOT_STYLE, YOU_GLOW_STYLE } from './layer-styles';
import { VenueLayers } from './venue-layers';
import { useVenueFootprints } from '@/hooks/city/useVenueFootprints';

// The welcome screens can open before the City tab has ever loaded, so the token is set here too.
if (ApiConstants.MapboxPublicToken) {
  Mapbox.setAccessToken(ApiConstants.MapboxPublicToken);
}

const NO_VENUES: readonly VenueSummary[] = [];

/** Fixed, like the city behind the mock's welcome screen (S-01): tilted, further out, steeper. */
const FIXED_CAMERA = {
  centerCoordinate: BACKDROP_CAMERA.center,
  zoomLevel: BACKDROP_CAMERA.zoom,
  pitch: BACKDROP_CAMERA.pitch,
  heading: BACKDROP_CAMERA.heading,
  padding: { paddingTop: BACKDROP_CAMERA.paddingTop, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
};

type Props = {
  style?: StyleProp<ViewStyle>;
  /**
   * The city before the lights are on (S-03): no beams, no lit roofs, only one cyan dot in the
   * middle, standing for you.
   */
  dark?: boolean;
};

/** Where the dark city's cyan dot sits: the middle of the picture. */
const YOU = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: BACKDROP_CAMERA.center } } as const;

/**
 * The night city as a still picture behind the welcome and first-run screens: the same violet
 * city and the same live beams as the City tab (or, with `dark`, no beams yet), without names,
 * controls or gestures. It takes no
 * touches; whatever is laid over it gets them all. Without a Mapbox token it is plain dark.
 *
 * The Mapbox wordmark stays on at the bottom left, as Mapbox's terms require.
 */
export const CityBackdrop = memo(function CityBackdrop({ style, dark = false }: Props) {
  const { data } = useVenues();
  const venues = data ?? NO_VENUES;
  const mapRef = useRef<MapView>(null);
  const { footprints, scan } = useVenueFootprints(venues);
  // Once the buildings are drawn, find each venue's own building so its beam stands on its roof.
  const handleIdle = useCallback(() => {
    void scan(mapRef.current);
  }, [scan]);

  return (
    <View style={[styles.root, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {ApiConstants.MapboxPublicToken ? (
        <MapView
          ref={mapRef}
          onMapIdle={handleIdle}
          style={StyleSheet.absoluteFill}
          styleURL={MAP_STYLE_URL}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          compassEnabled={false}
          scaleBarEnabled={false}
          attributionEnabled
          logoEnabled
        >
          <Camera defaultSettings={FIXED_CAMERA} />
          <CityStyle />
          {dark ? (
            <ShapeSource id="city-backdrop-you" shape={YOU}>
              <CircleLayer id="city-backdrop-you-glow" style={YOU_GLOW_STYLE} />
              <CircleLayer id="city-backdrop-you-dot" style={YOU_DOT_STYLE} />
              <CircleLayer id="city-backdrop-you-centre" style={YOU_CENTRE_STYLE} />
            </ShapeSource>
          ) : (
            <VenueLayers venues={venues} selectedId={null} flat={false} labels={false} footprints={footprints} />
          )}
        </MapView>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
});
