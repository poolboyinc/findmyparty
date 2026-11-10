import { memo } from 'react';
import {
  Atmosphere,
  BackgroundLayer,
  FillExtrusionLayer,
  FillLayer,
  Images,
  Light,
  LineLayer,
  SymbolLayer,
} from '@rnmapbox/maps';
import {
  BASEMAP_LAYER,
  BASEMAP_SOURCE,
  BUILDINGS,
  FACADE_IMAGE,
  FACADE_IMAGE_SCALE,
  LABEL_BOX_DATA_URI,
  LABEL_BOX_IMAGE,
  LAYER,
  SWITCH,
} from './constants';
import {
  ATMOSPHERE_STYLE,
  BASEMAP_STYLE,
  FILTER,
  LIGHT_STYLE,
  ROOF_STYLE,
  STREET_CORE_STYLE,
  STREET_GLOW_STYLE,
  WATER_EDGE_STYLE,
  buildingStyle,
} from './layer-styles';

const FACADE = require('@/assets/images/city-facade.png');

/** Images the city's layers use: the facade with lit windows, and the selected name's white block. */
const IMAGES = {
  [FACADE_IMAGE]: { image: FACADE, scale: FACADE_IMAGE_SCALE },
  [LABEL_BOX_IMAGE]: LABEL_BOX_DATA_URI,
};

// The package's FillExtrusionLayer types require both zoom bounds.
const BUILDING_ZOOM = { minZoomLevel: BUILDINGS.minZoom, maxZoomLevel: 24 } as const;
/** The city's own layers go above dark-v11's roads and under its borders and names. */
const BELOW = BASEMAP_LAYER.insertBelow;

/**
 * Turns Mapbox's dark-v11 into the mock's city:
 *  - its own layers repainted in place (`existing`: the id names a layer already in the style,
 *    nothing new is added): violet-black ground, deep navy water, dark roads, soft lavender names,
 *    no flat buildings, no shop or airport labels;
 *  - on top of them, on its own `composite` source: water rims, glowing streets, and the buildings
 *    extruded in dark violet with lit windows;
 *  - a violet haze towards the horizon and a cool violet light.
 *
 * Every switch is in `SWITCH` (constants.ts).
 */
export const CityStyle = memo(function CityStyle() {
  return (
    <>
      <Images images={IMAGES} />
      {SWITCH.atmosphere ? <Atmosphere style={ATMOSPHERE_STYLE} /> : null}
      {SWITCH.light ? <Light style={LIGHT_STYLE} /> : null}
      {SWITCH.restyleBasemap ? <BasemapPaint /> : null}

      <LineLayer
        id={LAYER.waterEdge}
        sourceID={BASEMAP_SOURCE}
        sourceLayerID="water"
        belowLayerID={BELOW}
        minZoomLevel={10}
        style={WATER_EDGE_STYLE}
      />
      {SWITCH.streetGlow ? (
        <>
          <LineLayer
            id={LAYER.streetGlow}
            sourceID={BASEMAP_SOURCE}
            sourceLayerID="road"
            belowLayerID={BELOW}
            filter={FILTER.streets}
            minZoomLevel={11}
            style={STREET_GLOW_STYLE}
          />
          <LineLayer
            id={LAYER.streetCore}
            sourceID={BASEMAP_SOURCE}
            sourceLayerID="road"
            belowLayerID={BELOW}
            filter={FILTER.streets}
            minZoomLevel={11}
            style={STREET_CORE_STYLE}
          />
        </>
      ) : null}
      <FillExtrusionLayer
        id={LAYER.buildings}
        sourceID={BASEMAP_SOURCE}
        sourceLayerID="building"
        belowLayerID={BELOW}
        filter={FILTER.buildings}
        style={BUILDING_STYLE}
        {...BUILDING_ZOOM}
      />
      {SWITCH.facadePattern ? (
        <FillExtrusionLayer
          id={LAYER.roofs}
          sourceID={BASEMAP_SOURCE}
          sourceLayerID="building"
          belowLayerID={BELOW}
          filter={FILTER.buildings}
          style={ROOF_STYLE}
          {...BUILDING_ZOOM}
        />
      ) : null}
    </>
  );
});

const BUILDING_STYLE = buildingStyle(SWITCH.facadePattern);

/** dark-v11's own layers, repainted. Only ids that exist in dark-v11 (constants.ts) are named. */
function BasemapPaint() {
  return (
    <>
      <BackgroundLayer id={BASEMAP_LAYER.land} existing style={BASEMAP_STYLE.land} />
      <FillLayer id={BASEMAP_LAYER.landStructure} existing style={BASEMAP_STYLE.landFill} />
      <FillLayer id={BASEMAP_LAYER.landuse} existing style={BASEMAP_STYLE.park} />
      <FillLayer id={BASEMAP_LAYER.nationalPark} existing style={BASEMAP_STYLE.park} />
      <FillLayer id={BASEMAP_LAYER.water} existing style={BASEMAP_STYLE.water} />
      <LineLayer id={BASEMAP_LAYER.waterway} existing style={BASEMAP_STYLE.waterway} />
      <FillLayer id={BASEMAP_LAYER.building} existing style={BASEMAP_STYLE.hidden} />
      {BASEMAP_LAYER.roads.map((id) => (
        <LineLayer key={id} id={id} existing style={BASEMAP_STYLE.road} />
      ))}
      {BASEMAP_LAYER.rails.map((id) => (
        <LineLayer key={id} id={id} existing style={BASEMAP_STYLE.rail} />
      ))}
      <SymbolLayer id={BASEMAP_LAYER.poiLabel} existing style={BASEMAP_STYLE.hidden} />
      <SymbolLayer id={BASEMAP_LAYER.airportLabel} existing style={BASEMAP_STYLE.hidden} />
      <SymbolLayer id={BASEMAP_LAYER.roadLabel} existing style={BASEMAP_STYLE.label} />
      {BASEMAP_LAYER.labels.map((id) => (
        <SymbolLayer key={id} id={id} existing style={BASEMAP_STYLE.label} />
      ))}
    </>
  );
}
