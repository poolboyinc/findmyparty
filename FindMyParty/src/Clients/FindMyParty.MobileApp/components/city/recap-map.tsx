import { memo, useCallback, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Mapbox, { Camera, CircleLayer, LineLayer, MapView, ShapeSource } from '@rnmapbox/maps';
import { ApiConstants } from '@/constants/api';
import { useVenueFootprints } from '@/hooks/city/useVenueFootprints';
import { colors } from '@/theme';
import { CityStyle } from './city-style';
import { CAMERA, MAP_STYLE_URL, type LngLat } from './constants';
import type { VenueOnMap } from './geojson';
import { ROUTE_GLOW_STYLE, YOU_GLOW_STYLE } from './layer-styles';
import { VenueLayers } from './venue-layers';

if (ApiConstants.MapboxPublicToken) {
  Mapbox.setAccessToken(ApiConstants.MapboxPublicToken);
}

type Props = {
  /** The venues of the night, in the order they were visited. */
  venues: readonly { id: string; name: string; latitude: number; longitude: number }[];
  style?: StyleProp<ViewStyle>;
};

/** Room kept around the venues, in points, so their beams fit in the picture. */
const PADDING = { paddingTop: 110, paddingRight: 56, paddingBottom: 36, paddingLeft: 56 };
/** Around a single venue the camera sits this close. */
const ONE_VENUE_ZOOM = 16.4;

/**
 * The top of the night recap card (S-16): the night city with the venues you were scanned into
 * lit, and a dashed cyan line from one to the next, ending in a cyan ring at the last.
 * It shows venues only: no streets walked, no times.
 *
 * It takes no touches. Once the map has drawn, a still picture of it replaces the live map, so the
 * card can be saved as an image like any other view.
 */
export const RecapMap = memo(function RecapMap({ venues, style }: Props) {
  const mapRef = useRef<MapView>(null);
  const [still, setStill] = useState<string | null>(null);
  const snapped = useRef(false);

  // Lit as busy venues, whatever they are doing right now: the card is about that night.
  const lit = useMemo<VenueOnMap[]>(
    () => venues.map((venue) => ({ ...venue, crowdLevel: '200+', crowdSource: 'live' })),
    [venues],
  );
  const { footprints, scan } = useVenueFootprints(lit);

  const path = useMemo(() => {
    const coordinates = venues.map((venue) => [venue.longitude, venue.latitude]);
    const last = coordinates[coordinates.length - 1];
    return {
      line: {
        type: 'FeatureCollection' as const,
        features: coordinates.length > 1 ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } }] : [],
      },
      end: {
        type: 'FeatureCollection' as const,
        features: last ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: last } }] : [],
      },
    };
  }, [venues]);

  const camera = useMemo(() => {
    if (venues.length === 0) return null;
    const lngs = venues.map((venue) => venue.longitude);
    const lats = venues.map((venue) => venue.latitude);
    const common = { pitch: 55, heading: CAMERA.heading };
    if (venues.length === 1) {
      return { ...common, centerCoordinate: [lngs[0], lats[0]] as LngLat, zoomLevel: ONE_VENUE_ZOOM, padding: PADDING };
    }
    return {
      ...common,
      bounds: { ne: [Math.max(...lngs), Math.max(...lats)], sw: [Math.min(...lngs), Math.min(...lats)], ...PADDING },
    };
  }, [venues]);

  const handleIdle = useCallback(() => {
    void scan(mapRef.current).then(() => {
      if (snapped.current) return;
      snapped.current = true;
      // A moment for the lit roofs to be drawn after the buildings are found, then keep the picture.
      setTimeout(() => {
        mapRef.current
          ?.takeSnap(true)
          .then((uri) => {
            if (uri) setStill(uri);
          })
          .catch(() => {
            // The live map stays; only saving the card as an image may then miss the map.
          });
      }, 700);
    });
  }, [scan]);

  if (!ApiConstants.MapboxPublicToken || !camera) return <View style={[styles.root, style]} />;

  return (
    <View style={[styles.root, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {still ? (
        <Image source={{ uri: still }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <MapView
          ref={mapRef}
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
          onMapIdle={handleIdle}
        >
          <Camera defaultSettings={camera} />
          <CityStyle />
          <ShapeSource id="city-recap-path" shape={path.line}>
            <LineLayer id="city-recap-path-glow" style={ROUTE_GLOW_STYLE} />
            <LineLayer id="city-recap-path-line" style={PATH_STYLE} />
          </ShapeSource>
          <VenueLayers venues={lit} selectedId={null} flat={false} labels={false} footprints={footprints} />
          <ShapeSource id="city-recap-end" shape={path.end}>
            <CircleLayer id="city-recap-end-ring" style={YOU_GLOW_STYLE} />
          </ShapeSource>
        </MapView>
      )}
    </View>
  );
});

/** The dashed cyan line between the night's venues. */
const PATH_STYLE: ComponentProps<typeof LineLayer>['style'] = {
  lineColor: colors.you,
  lineWidth: 2.5,
  lineDasharray: [1.6, 1.8],
  lineCap: 'round',
  lineJoin: 'round',
};

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
});
