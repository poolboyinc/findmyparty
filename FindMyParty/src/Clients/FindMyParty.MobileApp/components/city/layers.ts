// The map's layers as plain data, bottom to top. No React here: the app turns each entry into a
// Mapbox layer (spec-layer.tsx), and tools/city-preview draws the very same list in a browser, so
// the city can be looked at without a phone.

import type {
  BackgroundLayerStyle,
  CircleLayerStyle,
  FillExtrusionLayerStyle,
  FillLayerStyle,
  LineLayerStyle,
  SymbolLayerStyle,
} from '@rnmapbox/maps';
import { BASEMAP_LAYER, BASEMAP_SOURCE, BUILDINGS, LAYER, PULSE, SOURCE, SWITCH } from './constants';
import {
  BASEMAP_STYLE,
  FILTER,
  ROOF_STYLE,
  STREET_CORE_STYLE,
  STREET_GLOW_STYLE,
  WATER_EDGE_STYLE,
  beamStyle,
  buildingStyle,
  discDotStyle,
  discRingStyle,
  discStyle,
  groundGlowStyle,
  litBuildingStyle,
  nameStyle,
  pingStyle,
  ringStyle,
  selectedLabelStyle,
  type LayerFilter,
} from './layer-styles';

type StyleByType = {
  background: BackgroundLayerStyle;
  fill: FillLayerStyle;
  line: LineLayerStyle;
  fillExtrusion: FillExtrusionLayerStyle;
  circle: CircleLayerStyle;
  symbol: SymbolLayerStyle;
};

type SpecOf<K extends keyof StyleByType> = {
  type: K;
  id: string;
  style: StyleByType[K];
  /** `true`: the id names a layer dark-v11 already has; it is repainted, not added. */
  existing?: boolean;
  source?: string;
  sourceLayer?: string;
  /** Insert under this layer of the style instead of on top. */
  below?: string;
  filter?: LayerFilter;
  minZoom?: number;
  maxZoom?: number;
};

export type LayerSpec = { [K in keyof StyleByType]: SpecOf<K> }[keyof StyleByType];

/** The city's own layers go above dark-v11's roads and under its borders and names. */
const BELOW = BASEMAP_LAYER.insertBelow;

/** dark-v11's own layers, repainted. Only ids that exist in dark-v11 (constants.ts) are named. */
function basemapPaint(): LayerSpec[] {
  return [
    { type: 'background', id: BASEMAP_LAYER.land, existing: true, style: BASEMAP_STYLE.land },
    { type: 'fill', id: BASEMAP_LAYER.landStructure, existing: true, style: BASEMAP_STYLE.landFill },
    { type: 'fill', id: BASEMAP_LAYER.landuse, existing: true, style: BASEMAP_STYLE.park },
    { type: 'fill', id: BASEMAP_LAYER.nationalPark, existing: true, style: BASEMAP_STYLE.park },
    { type: 'fill', id: BASEMAP_LAYER.water, existing: true, style: BASEMAP_STYLE.water },
    { type: 'line', id: BASEMAP_LAYER.waterway, existing: true, style: BASEMAP_STYLE.waterway },
    { type: 'fill', id: BASEMAP_LAYER.building, existing: true, style: BASEMAP_STYLE.hidden },
    ...BASEMAP_LAYER.roads.map((id): LayerSpec => ({ type: 'line', id, existing: true, style: BASEMAP_STYLE.road })),
    ...BASEMAP_LAYER.rails.map((id): LayerSpec => ({ type: 'line', id, existing: true, style: BASEMAP_STYLE.rail })),
    { type: 'symbol', id: BASEMAP_LAYER.poiLabel, existing: true, style: BASEMAP_STYLE.hidden },
    { type: 'symbol', id: BASEMAP_LAYER.airportLabel, existing: true, style: BASEMAP_STYLE.hidden },
    { type: 'symbol', id: BASEMAP_LAYER.roadLabel, existing: true, style: BASEMAP_STYLE.label },
    ...BASEMAP_LAYER.labels.map((id): LayerSpec => ({ type: 'symbol', id, existing: true, style: BASEMAP_STYLE.label })),
  ];
}

/**
 * Mapbox's dark-v11 turned into the mock's city: its own layers repainted in place, then, on its
 * `composite` source, water rims, glowing streets, and the buildings in dark violet with lit windows.
 */
export function cityLayers(): LayerSpec[] {
  const street = { source: BASEMAP_SOURCE, sourceLayer: 'road', below: BELOW, filter: FILTER.streets, minZoom: 11 } as const;
  const building = {
    source: BASEMAP_SOURCE,
    sourceLayer: 'building',
    below: BELOW,
    filter: FILTER.buildings,
    minZoom: BUILDINGS.minZoom,
  } as const;
  return [
    ...(SWITCH.restyleBasemap ? basemapPaint() : []),
    { type: 'line', id: LAYER.waterEdge, source: BASEMAP_SOURCE, sourceLayer: 'water', below: BELOW, minZoom: 10, style: WATER_EDGE_STYLE },
    ...(SWITCH.streetGlow
      ? ([
          { type: 'line', id: LAYER.streetGlow, ...street, style: STREET_GLOW_STYLE },
          { type: 'line', id: LAYER.streetCore, ...street, style: STREET_CORE_STYLE },
        ] satisfies LayerSpec[])
      : []),
    { type: 'fillExtrusion', id: LAYER.buildings, ...building, style: buildingStyle(SWITCH.facadePattern) },
    ...(SWITCH.facadePattern
      ? ([{ type: 'fillExtrusion', id: LAYER.roofs, ...building, style: ROOF_STYLE }] satisfies LayerSpec[])
      : []),
  ];
}

/**
 * Every venue as light, drawn by the map itself (no React view per venue). Three groups, each on
 * its own source, bottom to top:
 *   ground  the pool of light under a lit venue; in 2D, the discs;
 *   shapes  the bright line round the roof of the venue's building and the lines up its corners;
 *   lights  the ring on the roof, the beam standing in it, then names with their crowd, the selected block.
 */
export function venueLayers(flat: boolean, labels: boolean): { ground: LayerSpec[]; shapes: LayerSpec[]; lights: LayerSpec[] } {
  const ground = { source: SOURCE.venuePoints } as const;
  const shapes = { source: SOURCE.venueShapes } as const;
  const lights = { source: SOURCE.venueLights } as const;
  const lit = litBuildingStyle(flat);
  return {
    ground: [
      { type: 'circle', id: LAYER.groundGlow, ...ground, style: groundGlowStyle(flat) },
      { type: 'circle', id: LAYER.disc, ...ground, style: discStyle(flat) },
      { type: 'circle', id: LAYER.discDot, ...ground, style: discDotStyle(flat) },
      { type: 'circle', id: LAYER.discRing, ...ground, filter: FILTER.selected, style: discRingStyle(flat) },
    ],
    shapes: [
      { type: 'fillExtrusion', id: LAYER.cornerPosts, ...shapes, filter: FILTER.post, style: lit },
      { type: 'fillExtrusion', id: LAYER.roofFrame, ...shapes, filter: FILTER.frame, style: lit },
    ],
    lights: [
      { type: 'symbol', id: LAYER.roofRing, ...lights, style: ringStyle(flat) },
      { type: 'symbol', id: LAYER.beam, ...lights, filter: FILTER.hasBeam, style: beamStyle(flat) },
      ...(labels
        ? ([
            { type: 'symbol', id: LAYER.labelNames, ...lights, filter: FILTER.names, style: nameStyle() },
            { type: 'symbol', id: LAYER.labelSelected, ...lights, filter: FILTER.selected, style: selectedLabelStyle() },
          ] satisfies LayerSpec[])
        : []),
    ],
  };
}

/**
 * The pulse on busy venues' roofs: one layer per ripple, under the roof ring (they share the
 * `lights` source and are mounted before its other layers). `step` is where the pulse is:
 * 0, 1, 2 light the ripples from the inside out; any other value is the rest between pulses.
 */
export function pingLayers(flat: boolean, step: number): LayerSpec[] {
  return PULSE.sizes.map((_, index) => ({
    type: 'symbol',
    id: `${LAYER.ping}${index}`,
    source: SOURCE.venueLights,
    filter: FILTER.hasPing,
    style: pingStyle(flat, index, index === step),
  }));
}
