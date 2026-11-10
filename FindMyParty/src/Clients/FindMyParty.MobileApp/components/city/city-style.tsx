import { FillExtrusionLayer } from '@rnmapbox/maps';
import { LAYER, USE_STANDARD_STYLE } from './constants';
import { BUILDINGS_FILTER, BUILDINGS_STYLE } from './layer-styles';

/**
 * Only for the fallback style (dark-v11), which has no 3D buildings of its own: extrudes them in
 * dark violet. With Mapbox Standard the night is part of the style document (constants.ts).
 */
export function CityStyle() {
  // With Standard the night and the label switches are part of the style document itself
  // (NIGHT_STYLE_JSON in constants.ts), so nothing needs adding here.
  if (USE_STANDARD_STYLE) return null;

  return (
    <FillExtrusionLayer
      id={LAYER.buildings}
      sourceID="composite"
      sourceLayerID="building"
      filter={BUILDINGS_FILTER}
      minZoomLevel={13}
      maxZoomLevel={24}
      style={BUILDINGS_STYLE}
    />
  );
}
