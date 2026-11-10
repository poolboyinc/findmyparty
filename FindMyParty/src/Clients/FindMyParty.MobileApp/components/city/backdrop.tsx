import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Mapbox, { Camera, MapView } from '@rnmapbox/maps';
import { ApiConstants } from '@/constants/api';
import { useVenues } from '@/hooks/queries';
import { colors } from '@/theme';
import type { VenueSummary } from '@/types/api';
import { CityStyle } from './city-style';
import { BACKDROP_CAMERA, MAP_STYLE_URL } from './constants';
import { VenueLayers } from './venue-layers';

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

type Props = { style?: StyleProp<ViewStyle> };

/**
 * The night city as a still picture behind the welcome and first-run screens: the same violet
 * city and the same live beams as the City tab, without names, controls or gestures. It takes no
 * touches; whatever is laid over it gets them all. Without a Mapbox token it is plain dark.
 *
 * The Mapbox wordmark stays on at the bottom left, as Mapbox's terms require.
 */
export const CityBackdrop = memo(function CityBackdrop({ style }: Props) {
  const { data } = useVenues();

  return (
    <View style={[styles.root, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {ApiConstants.MapboxPublicToken ? (
        <MapView
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
          <VenueLayers venues={data ?? NO_VENUES} selectedId={null} flat={false} labels={false} />
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
