// The map's layers as plain data, bottom to top. No React here: the app turns each entry into a
// Mapbox layer (spec-layer.tsx), and tools/city-preview draws the very same list in a browser, so
// the city can be looked at without a phone.

import type {
  BackgroundLayerStyle,
  CircleLayerStyle,
  FillExtrusionLayerStyle,
  FillLayerStyle,
  LineLayerStyle,
  ModelLayerStyle,
  SymbolLayerStyle,
} from '@rnmapbox/maps';
import { BASEMAP_LAYER, BASEMAP_SOURCE, BUILDINGS, LAYER, PULSE, SIGN, SOURCE, SWITCH } from './constants';
import {
  BASEMAP_STYLE,
  FILTER,
  FRIEND_AVATAR_STYLE,
  FRIEND_VENUE_STYLE,
  ROOF_STYLE,
  SIGN_HOLOGRAM_STYLE,
  SIGN_PANEL_STYLE,
  SIGN_SLAB_STYLE,
  SIGN_TAG_STYLE,
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
  model: ModelLayerStyle;
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
 * Every venue as light, drawn by the map itself (no React view per venue). Four groups, each on
 * its own source, bottom to top:
 *   glow    the pool of light under a lit venue (on its own source so it cannot be tapped: it is wide);
 *   ground  in 2D, the discs;
 *   shapes  the bright line round the roof of the venue's building and the lines up its corners;
 *   lights  the ring on the roof, the beam standing in it, then names with their crowd, the selected block.
 *
 * Every layer is always there and is switched with `visibility`: the map puts a layer that is
 * mounted later on top of everything, whatever its place in this list.
 */
export function venueLayers(
  flat: boolean,
  /** `false`: names are hidden (the welcome backdrop; the Friends layer, whose own marks carry names). */
  labels: boolean,
  /** Friends layer: beams and rings at part strength. */
  dim = false,
): { glow: LayerSpec[]; ground: LayerSpec[]; shapes: LayerSpec[]; lights: LayerSpec[] } {
  const ground = { source: SOURCE.venuePoints } as const;
  const shapes = { source: SOURCE.venueShapes } as const;
  const lights = { source: SOURCE.venueLights } as const;
  const lit = litBuildingStyle(flat);
  return {
    glow: [{ type: 'circle', id: LAYER.groundGlow, source: SOURCE.venueGlow, style: groundGlowStyle(flat) }],
    ground: [
      { type: 'circle', id: LAYER.disc, ...ground, style: discStyle(flat) },
      { type: 'circle', id: LAYER.discDot, ...ground, style: discDotStyle(flat) },
      { type: 'circle', id: LAYER.discRing, ...ground, filter: FILTER.selected, style: discRingStyle(flat) },
    ],
    shapes: [
      { type: 'fillExtrusion', id: LAYER.cornerPosts, ...shapes, filter: FILTER.post, style: lit },
      { type: 'fillExtrusion', id: LAYER.roofFrame, ...shapes, filter: FILTER.frame, style: lit },
    ],
    lights: [
      { type: 'symbol', id: LAYER.roofRing, ...lights, style: ringStyle(flat, dim) },
      { type: 'symbol', id: LAYER.beam, ...lights, filter: FILTER.hasBeam, style: beamStyle(flat, dim) },
      { type: 'symbol', id: LAYER.labelNames, ...lights, filter: FILTER.names, style: nameStyle(!labels) },
      { type: 'symbol', id: LAYER.labelSelected, ...lights, filter: FILTER.selected, style: selectedLabelStyle(!labels) },
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

/**
 * Signs, bottom to top: the slab on the wall, the 3D panel just in front of it, then holograms
 * and the "Ad" tags. Each group has its own source (SOURCE.signSlabs, signPanels, signMarks).
 */
export function signLayers(): { slabs: LayerSpec[]; panels: LayerSpec[]; marks: LayerSpec[] } {
  const minZoom = SIGN.fromZoom;
  return {
    slabs: [{ type: 'fillExtrusion', id: LAYER.signSlab, source: SOURCE.signSlabs, minZoom, style: SIGN_SLAB_STYLE }],
    panels: [{ type: 'model', id: LAYER.signPanel, source: SOURCE.signPanels, minZoom, style: SIGN_PANEL_STYLE }],
    marks: [
      { type: 'symbol', id: LAYER.signHologram, source: SOURCE.signMarks, minZoom, filter: FILTER.hologram, style: SIGN_HOLOGRAM_STYLE },
      { type: 'symbol', id: LAYER.signTag, source: SOURCE.signMarks, minZoom, filter: FILTER.tag, style: SIGN_TAG_STYLE },
    ],
  };
}

/** The Friends layer's marks (SOURCE.friends): the rings with initials, then the venue names. */
export function friendLayers(): LayerSpec[] {
  const source = SOURCE.friends;
  return [
    { type: 'symbol', id: LAYER.friendAvatar, source, filter: FILTER.avatar, style: FRIEND_AVATAR_STYLE },
    { type: 'symbol', id: LAYER.friendVenue, source, filter: FILTER.friendVenue, style: FRIEND_VENUE_STYLE },
  ];
}
