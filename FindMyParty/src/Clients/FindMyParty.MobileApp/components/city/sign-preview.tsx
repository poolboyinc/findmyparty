import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Mapbox, { Camera, MapView } from '@rnmapbox/maps';
import { ApiConstants } from '@/constants/api';
import { useVenues } from '@/hooks/queries';
import { useVenueFootprints } from '@/hooks/city/useVenueFootprints';
import { colors } from '@/theme';
import { CityStyle } from './city-style';
import { MAP_STYLE_URL, type LngLat } from './constants';
import type { VenueOnMap } from './geojson';
import { SignLayers } from './sign-layers';
import { move, type SignOnMap } from './signs';
import { VenueLayers } from './venue-layers';

if (ApiConstants.MapboxPublicToken) {
  Mapbox.setAccessToken(ApiConstants.MapboxPublicToken);
}

type Props = {
  /** The wall or roof the sign would go on. */
  spot: SignOnMap['spot'] & { format: 'facade' | 'hologram' };
  /** The sign as it is being made: "VOLT", "AURA|SPRITZ". */
  text: string;
  colorTop: string;
  colorBottom: string;
  ink: string;
  style?: StyleProp<ViewStyle>;
};

const NO_VENUES: readonly VenueOnMap[] = [];
/** The camera stands off to one side of the wall, so the sign and the street both show. */
const SIDE_DEG = 28;

/**
 * "Preview, spot 3, Njegoševa" on the host's sign screen (S-20): the real spot in the night city
 * with the host's sign on it, drawn exactly as guests would see it, venues' lights around it.
 * It takes no touches; the screen around it handles taps.
 */
export const SignPreview = memo(function SignPreview({ spot, text, colorTop, colorBottom, ink, style }: Props) {
  const { data } = useVenues();
  const venues: readonly VenueOnMap[] = data ?? NO_VENUES;
  const { footprints } = useVenueFootprints(venues);

  const sign = useMemo<SignOnMap[]>(
    () => [{ id: 'preview', format: spot.format, own: true, text: text.trim() || ' ', colorTop, colorBottom, ink, spot }],
    [spot, text, colorTop, colorBottom, ink],
  );

  const camera = useMemo(() => {
    const at: LngLat = [spot.longitude, spot.latitude];
    if (spot.format === 'hologram') {
      return { centerCoordinate: at, zoomLevel: 16.9, pitch: 62, heading: -17, padding: PAD_HOLOGRAM };
    }
    // Look at the wall from in front of it: the camera faces the opposite way to the wall.
    const [lng, lat] = move(at, spot.bearingDeg, 6);
    return { centerCoordinate: [lng, lat] as LngLat, zoomLevel: 17.5, pitch: 62, heading: spot.bearingDeg + 180 + SIDE_DEG, padding: PAD_FACADE };
  }, [spot]);

  if (!ApiConstants.MapboxPublicToken) return <View style={[styles.root, style]} />;

  return (
    <View style={[styles.root, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <MapView
        key={`${spot.longitude},${spot.latitude},${spot.format}`}
        style={StyleSheet.absoluteFill}
        styleURL={MAP_STYLE_URL}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        attributionEnabled={false}
        logoEnabled
      >
        <Camera defaultSettings={camera} />
        <CityStyle />
        <VenueLayers venues={venues} selectedId={null} flat={false} labels={false} footprints={footprints} />
        <SignLayers signs={sign} />
      </MapView>
    </View>
  );
});

const PAD_FACADE = { paddingTop: 40, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 };
const PAD_HOLOGRAM = { paddingTop: 90, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 };

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
});
