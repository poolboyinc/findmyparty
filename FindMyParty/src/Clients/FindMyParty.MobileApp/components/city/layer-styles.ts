// How each map layer is painted. Every property and expression operator used here exists in
// node_modules/@rnmapbox/maps/src/utils/MapboxStyles.ts and has a setter in
// node_modules/@rnmapbox/maps/ios/RNMBX/RNMBXStyle.swift. Expressions are kept to the plain ones
// (get, ==, !=, >=, all, any, case, match, step, interpolate, zoom, geometry-type, +, -, *): on iOS
// the package decodes text and colour expressions with `try!`, so an exotic one would crash the app
// instead of being ignored. No `format`, no `literal`: arrays come from feature properties.
//
// The city runs on dark-v11, a classic style with a flat light. There the emissive-strength
// properties of Mapbox Standard do nothing, so brightness comes from the colours themselves.

import type { ComponentProps } from 'react';
import type {
  AtmosphereLayerStyle as AtmosphereLayerStyleProps,
  BackgroundLayerStyle as BackgroundLayerStyleProps,
  CircleLayer,
  CircleLayerStyle as CircleLayerStyleProps,
  FillExtrusionLayerStyle as FillExtrusionLayerStyleProps,
  FillLayerStyle as FillLayerStyleProps,
  LightLayerStyle as LightLayerStyleProps,
  LineLayerStyle as LineLayerStyleProps,
  ModelLayerStyle as ModelLayerStyleProps,
  SymbolLayerStyle as SymbolLayerStyleProps,
} from '@rnmapbox/maps';
import { colors } from '@/theme';
import { FRIEND_MARK } from './geojson';
import { FRIEND_RING } from './sprites';
import { BUILDINGS, FACADE_IMAGE, FRAME, GROUND_GLOW, LABEL, LABEL_BOX_IMAGE, PALETTE, PULSE, SIGN, SPRITE, SWITCH } from './constants';

/** A Mapbox expression, as the package types it. */
type Expr = Extract<NonNullable<CircleLayerStyleProps['circleRadius']>, readonly unknown[]>;
type Num = number | Expr;
export type LayerFilter = NonNullable<ComponentProps<typeof CircleLayer>['filter']>;

const QUICK = { duration: 300, delay: 0 } as const;

const STRENGTH: Expr = ['get', 'strength'];
const COLOR: Expr = ['get', 'color'];
const IS_SELECTED: Expr = ['==', ['get', 'selected'], true];
const IS_EXPECTED: Expr = ['==', ['get', 'expected'], true];
const IS_GHOST: Expr = ['==', ['get', 'ghost'], true];
const KIND = (kind: string): Expr => ['==', ['get', 'kind'], kind];

/** A size that grows as the map zooms in. */
function byZoom(far: Num, mid: Num, near: Num): Expr {
  return ['interpolate', ['linear'], ['zoom'], 11, far, 14, mid, 17, near];
}

/** `base` for an empty venue, up to `base + gain` for the busiest. */
function withStrength(base: number, gain: number): Expr {
  return ['+', base, ['*', gain, STRENGTH]];
}

/** [zoom, value, zoom, value, …] as one top-level interpolate on zoom. */
function zoomStops(stops: readonly number[]): Expr {
  return ['interpolate', ['linear'], ['zoom'], ...stops];
}

// ── Filters ─────────────────────────────────────────────────────────────────

/** Names: always in My City; in Live, further out only the busy ones. Never the selected one. */
// Mapbox only accepts ["zoom"] as the input of a top-level step or interpolate, so the zoom rule
// is the outermost expression and each branch carries the other conditions.
const NOT_SELECTED: Expr = ['!=', ['get', 'selected'], true];
function named(extra: Expr | null = null): Expr {
  const more: Expr[] = extra ? [extra] : [];
  const far: Expr = ['all', NOT_SELECTED, ['any', ['==', ['get', 'mode'], 'mine'], ['>=', STRENGTH, LABEL.minStrength]], ...more];
  const near: Expr = ['all', NOT_SELECTED, ...more];
  return ['step', ['zoom'], far, LABEL.allFromZoom, near];
}
const NAMED: Expr = named();

/** Mapbox Streets road classes that get a glowing line. A plain array: the package types want it mutable. */
const STREET_CLASSES: string[] = [
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'street',
  'street_limited',
  'pedestrian',
];

/**
 * One part of a lit building, in the zoom band it was made for. The zoom rule is the outermost
 * expression (Mapbox only accepts ["zoom"] there); the map checks it once per whole zoom level,
 * which is exactly where the bands change.
 */
function banded(kind: string): Expr {
  const inBand = (band: number): Expr => ['all', KIND(kind), ['==', ['get', 'band'], band]];
  const steps: (number | Expr)[] = [];
  FRAME.bandFromZoom.forEach((zoom, index) => {
    steps.push(zoom, inBand(index + 1));
  });
  return ['step', ['zoom'], inBand(0), ...steps];
}

export const FILTER = {
  selected: IS_SELECTED,
  names: NAMED,
  /** Venues that have a picture to show: '' means none. */
  hasBeam: ['!=', ['get', 'beam'], ''],
  hasPing: ['!=', ['get', 'ping'], ''],
  hologram: KIND('hologram'),
  avatar: KIND('avatar'),
  friendVenue: KIND('name'),
  tag: KIND('tag'),
  frame: banded('frame'),
  post: banded('post'),
  /** Mapbox Streets buildings that are meant to be drawn in 3D. */
  buildings: ['==', ['get', 'extrude'], 'true'],
  /** Every road a car or a person walks along, not paths, tracks or rails. */
  streets: ['all', ['==', ['geometry-type'], 'LineString'], ['match', ['get', 'class'], STREET_CLASSES, true, false]],
} as const;

// ── Basemap: dark-v11's own layers, repainted ───────────────────────────────

export const BASEMAP_STYLE = {
  land: { backgroundColor: PALETTE.ground } satisfies BackgroundLayerStyleProps,
  landFill: { fillColor: PALETTE.ground } satisfies FillLayerStyleProps,
  park: { fillColor: PALETTE.park } satisfies FillLayerStyleProps,
  water: { fillColor: PALETTE.water } satisfies FillLayerStyleProps,
  waterway: { lineColor: PALETTE.water } satisfies LineLayerStyleProps,
  hidden: { visibility: 'none' } as const,
  road: { lineColor: PALETTE.road } satisfies LineLayerStyleProps,
  rail: { lineColor: PALETTE.rail } satisfies LineLayerStyleProps,
  /** Street and place names: soft lavender on a dark edge, sentence case, not spaced out. */
  label: {
    textColor: PALETTE.label,
    textOpacity: 0.55,
    textHaloColor: PALETTE.ground,
    textHaloWidth: 1.2,
    textHaloBlur: 0.5,
    textTransform: 'none',
    textLetterSpacing: 0,
  } satisfies SymbolLayerStyleProps,
} as const;

/** The rim of rivers and lakes, as the mock draws the river: a thin blue-violet line. */
export const WATER_EDGE_STYLE: LineLayerStyleProps = {
  lineColor: PALETTE.waterEdge,
  lineOpacity: 0.45,
  lineWidth: byZoom(0.5, 0.9, 1.4),
  lineBlur: 0.6,
};

// ── Streets ─────────────────────────────────────────────────────────────────

/** 1 for the big roads, 0 for side streets. */
const MAJOR: Expr = [
  'match',
  ['get', 'class'],
  ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'tertiary'],
  1,
  0,
];

function byClass(major: number, minor: number): Expr {
  return ['+', minor, ['*', major - minor, MAJOR]];
}

/** The wide soft glow along each street. */
export const STREET_GLOW_STYLE: LineLayerStyleProps = {
  lineColor: PALETTE.street,
  lineWidth: ['interpolate', ['linear'], ['zoom'], 12, byClass(2.5, 0.8), 15, byClass(9, 3), 18, byClass(26, 9)],
  lineBlur: ['interpolate', ['linear'], ['zoom'], 12, byClass(2, 0.6), 15, byClass(7, 2.4), 18, byClass(20, 7)],
  lineOpacity: byClass(0.42, 0.14),
  lineCap: 'round',
  lineJoin: 'round',
};

/** The thin bright line in the middle of the glow. */
export const STREET_CORE_STYLE: LineLayerStyleProps = {
  lineColor: PALETTE.streetCore,
  lineWidth: ['interpolate', ['linear'], ['zoom'], 12, byClass(0.6, 0.25), 15, byClass(1.3, 0.5), 18, byClass(2.6, 1)],
  lineOpacity: byClass(0.85, 0.32),
  lineCap: 'round',
  lineJoin: 'round',
};

// ── Buildings ───────────────────────────────────────────────────────────────

const HEIGHT: Expr = ['get', 'height'];
const MIN_HEIGHT: Expr = ['get', 'min_height'];

/**
 * A height in metres, stretched upwards (BUILDINGS.stretch) and rising out of the ground just past
 * the zoom where buildings begin, so tiles do not pop in flat. One top-level interpolate, as
 * Mapbox requires.
 */
function growing(value: Expr): Expr {
  const z0 = BUILDINGS.minZoom;
  return ['interpolate', ['linear'], ['zoom'], z0, 0, z0 + BUILDINGS.riseOverZoom, ['*', BUILDINGS.stretch, value]];
}

/**
 * The city's buildings in dark violet. With the facade image, the walls carry lit windows;
 * the image then replaces the colour, so the roofs get their own slab (`ROOF_STYLE`).
 */
export function buildingStyle(withFacade: boolean): FillExtrusionLayerStyleProps {
  return {
    fillExtrusionColor: PALETTE.wall,
    ...(withFacade ? { fillExtrusionPattern: FACADE_IMAGE } : {}),
    fillExtrusionHeight: growing(HEIGHT),
    fillExtrusionBase: growing(MIN_HEIGHT),
    fillExtrusionOpacity: BUILDINGS.opacity,
    // Darker at the foot of each wall, lighter towards the top.
    fillExtrusionVerticalGradient: true,
    fillExtrusionAmbientOcclusionIntensity: BUILDINGS.ambientOcclusion,
    fillExtrusionAmbientOcclusionRadius: 3,
  };
}

/** A thin slab on every roof, so roofs stay plain dark violet when the walls have windows. */
export const ROOF_STYLE: FillExtrusionLayerStyleProps = {
  fillExtrusionColor: PALETTE.roof,
  fillExtrusionBase: growing(HEIGHT),
  fillExtrusionHeight: growing(['+', HEIGHT, BUILDINGS.roofCapM]),
  fillExtrusionOpacity: 1,
  fillExtrusionVerticalGradient: false,
};

// ── Air and light ───────────────────────────────────────────────────────────

/** Violet haze towards the horizon, dark above it. Replaces dark-v11's black fog. */
export const ATMOSPHERE_STYLE: AtmosphereLayerStyleProps = {
  color: PALETTE.haze,
  highColor: PALETTE.hazeHigh,
  spaceColor: PALETTE.space,
  horizonBlend: 0.12,
  range: [1, 7],
  starIntensity: 0,
};

/**
 * A cool violet light, fixed to the screen, so walls facing the lower left read lighter.
 * Its position is left at Mapbox's default ([1.15, 210, 30]): on iOS with SDK v11 the package
 * converts the first number of `position` from degrees to radians (RNMBXStyleValue.swift,
 * getSphericalPosition), which would shrink the light's distance to almost nothing.
 */
export const LIGHT_STYLE: LightLayerStyleProps = {
  anchor: 'viewport',
  color: PALETTE.light,
  intensity: 0.4,
};

// ── A venue's light ─────────────────────────────────────────────────────────

/** Metres above the ground of the venue's roof, stretched like the city's buildings. */
const ON_THE_ROOF: Expr = growing(['get', 'roofM']);

/** How much of the crowd's light is left on the Friends layer. */
const DIMMED = 0.4;

const BEAM_SIZE: Num = SWITCH.beamsScaleWithZoom ? zoomStops(SPRITE.sizeByZoom) : 1;
const RING_SIZE: Num = zoomStops(SPRITE.ringByZoom);

/**
 * The beam: a picture of light standing on the roof, always upright and facing the camera, the
 * same few points wide whatever the zoom. Hidden in flat (2D) mode, where the discs carry the picture.
 */
export function beamStyle(flat: boolean, dim = false): SymbolLayerStyleProps {
  return {
    visibility: flat ? 'none' : 'visible',
    // Friends layer: the crowd's light steps back so the friends stand out.
    iconOpacity: dim ? DIMMED : 1,
    iconOpacityTransition: QUICK,
    iconImage: ['get', 'beam'],
    iconSize: BEAM_SIZE,
    iconAnchor: 'bottom',
    // The picture has a pool of light below the beam's foot; push it down so the foot is on the roof.
    iconOffset: [0, SPRITE.haloPt],
    iconPitchAlignment: 'viewport',
    iconRotationAlignment: 'viewport',
    iconAllowOverlap: true,
    iconIgnorePlacement: true,
    symbolZOffset: ON_THE_ROOF,
  };
}

/** The ring the beam rises from: it lies flat on the roof, so the tilt turns it into an ellipse. */
export function ringStyle(flat: boolean, dim = false): SymbolLayerStyleProps {
  return {
    visibility: flat ? 'none' : 'visible',
    iconOpacity: dim ? DIMMED : 1,
    iconOpacityTransition: QUICK,
    iconImage: ['get', 'ring'],
    iconSize: RING_SIZE,
    iconPitchAlignment: 'map',
    iconRotationAlignment: 'map',
    iconAllowOverlap: true,
    iconIgnorePlacement: true,
    symbolZOffset: ON_THE_ROOF,
  };
}

/**
 * One ripple of the pulse on a busy venue's roof. `lit` is whether this ripple is the one showing
 * right now; the map fades it in and out by itself, so the ripples read as one ring spreading.
 */
export function pingStyle(flat: boolean, step: number, lit: boolean): SymbolLayerStyleProps {
  const scale = PULSE.sizes[step];
  return {
    visibility: flat ? 'none' : 'visible',
    iconImage: ['get', 'ping'],
    iconSize: zoomStops(SPRITE.ringByZoom.map((value, index) => (index % 2 === 1 ? value * scale : value))),
    iconPitchAlignment: 'map',
    iconRotationAlignment: 'map',
    iconAllowOverlap: true,
    iconIgnorePlacement: true,
    iconOpacity: lit ? PULSE.opacity[step] : 0,
    iconOpacityTransition: { duration: PULSE.fadeMs, delay: 0 },
    symbolZOffset: ON_THE_ROOF,
  };
}

/**
 * The bright line along the roof edge and the lines up the corners of a venue's building:
 * stretched like the city's buildings, so they sit exactly on them.
 */
export function litBuildingStyle(flat: boolean): FillExtrusionLayerStyleProps {
  return {
    visibility: flat ? 'none' : 'visible',
    fillExtrusionColor: ['get', 'fill'],
    fillExtrusionBase: growing(['get', 'base']),
    fillExtrusionHeight: growing(['get', 'top']),
    fillExtrusionOpacity: 1,
    // Light, not a wall: the same brightness from foot to top.
    fillExtrusionVerticalGradient: false,
  };
}

// ── On the ground ───────────────────────────────────────────────────────────

/** The soft pool of light on the ground around a lit venue. In flat mode it grows with the crowd. */
export function groundGlowStyle(flat: boolean): CircleLayerStyleProps {
  const [far, mid, near] = GROUND_GLOW.radius;
  return {
    circleColor: COLOR,
    circleRadius: flat ? byZoom(withStrength(8, 8), withStrength(16, 22), withStrength(30, 36)) : byZoom(far, mid, near),
    circleRadiusTransition: QUICK,
    circleBlur: 1,
    // An expected crowd glows less than one that is really there; a ghost not at all.
    circleOpacity: ['case', IS_GHOST, 0, IS_EXPECTED, GROUND_GLOW.expected, GROUND_GLOW.live],
    circlePitchAlignment: 'map',
    circlePitchScale: 'map',
  };
}

/**
 * Flat mode only: the venue's mark, as in the mock: a see-through disc with a solid edge, sized by
 * the crowd. A My City ghost is an empty dim ring.
 */
export function discStyle(flat: boolean): CircleLayerStyleProps {
  return {
    visibility: flat ? 'visible' : 'none',
    circleColor: COLOR,
    circleRadius: byZoom(withStrength(3, 3), withStrength(6, 9), withStrength(10, 14)),
    circleRadiusTransition: QUICK,
    circleOpacity: ['case', IS_GHOST, 0, 0.3],
    circleStrokeColor: ['case', IS_GHOST, colors.label, COLOR],
    circleStrokeWidth: ['case', IS_GHOST, 1, 1.5],
    circleStrokeOpacity: ['case', IS_GHOST, 0.4, 1],
    circlePitchAlignment: 'map',
    circlePitchScale: 'map',
  };
}

/** Flat mode only: the white dot in the middle of a disc. */
export function discDotStyle(flat: boolean): CircleLayerStyleProps {
  return {
    visibility: flat ? 'visible' : 'none',
    circleColor: colors.label,
    circleRadius: 2.2,
    circleOpacity: ['case', IS_GHOST, 0, 1],
    circlePitchAlignment: 'map',
  };
}

/** Flat mode only: a white ring around the selected venue's disc. */
export function discRingStyle(flat: boolean): CircleLayerStyleProps {
  return {
    visibility: flat ? 'visible' : 'none',
    circleColor: colors.label,
    circleOpacity: 0,
    circleRadius: byZoom(withStrength(6, 3), withStrength(10, 9), withStrength(15, 14)),
    circleRadiusTransition: QUICK,
    circleStrokeColor: colors.label,
    circleStrokeWidth: 2,
    circlePitchAlignment: 'map',
    circlePitchScale: 'map',
  };
}

// ── Labels ──────────────────────────────────────────────────────────────────

/** dark-v11's own font, so no extra glyphs are downloaded. Coolvetica cannot be used on the map. */
const MAP_FONT = ['DIN Pro Bold', 'Arial Unicode MS Bold'];

/** A value each venue carries at the three zooms of SPRITE.sizeByZoom (`…Far`, `…Mid`, `…Near`). */
function perZoom(part: 'name' | 'count' | 'block'): Expr {
  const [z0, , z1, , z2] = SPRITE.sizeByZoom;
  if (!SWITCH.beamsScaleWithZoom) return ['get', `${part}Mid`];
  return ['interpolate', ['linear'], ['zoom'], z0, ['get', `${part}Far`], z1, ['get', `${part}Mid`], z2, ['get', `${part}Near`]];
}

/**
 * A venue's name and, under it, its crowd ("200+") just above the tip of the beam: the name is
 * type set straight on the map, white with a dark edge, no box; the crowd is a small picture in the
 * venue's colour. They are one label: where two venues' labels would overlap, the busier venue
 * keeps its label whole and the other shows only its beam until you zoom in. A ghost's name is dim.
 */
export function nameStyle(hidden = false): SymbolLayerStyleProps {
  return {
    // Hidden, not unmounted: a layer mounted later would land on top of everything.
    visibility: hidden ? 'none' : 'visible',
    symbolZOffset: ON_THE_ROOF,
    textField: ['get', 'name'],
    textFont: MAP_FONT,
    textSize: ['get', 'nameSize'],
    textMaxWidth: 9,
    textAnchor: 'bottom',
    textJustify: 'center',
    textOffset: perZoom('name'),
    textColor: ['get', 'nameColor'],
    textHaloColor: colors.bg,
    textHaloWidth: 1.4,
    textHaloBlur: 0.8,
    textPadding: 3,
    iconImage: ['get', 'count'],
    iconAnchor: 'bottom',
    iconOffset: perZoom('count'),
    iconPadding: 1,
    // Busy venues get their place first.
    symbolSortKey: ['-', 1, STRENGTH],
  };
}

/** The selected venue: dark type on a white block, name and crowd on two lines (S-05). Always shown. */
export function selectedLabelStyle(hidden = false): SymbolLayerStyleProps {
  return {
    visibility: hidden ? 'none' : 'visible',
    symbolZOffset: ON_THE_ROOF,
    textField: ['get', 'text'],
    textFont: MAP_FONT,
    textSize: LABEL.selectedSize,
    textLineHeight: 1.15,
    textAnchor: 'bottom',
    textJustify: 'center',
    textOffset: perZoom('block'),
    textColor: colors.ink,
    textAllowOverlap: true,
    iconImage: LABEL_BOX_IMAGE,
    iconTextFit: 'both',
    // Points around the text: top, right, bottom, left.
    iconTextFitPadding: [5, 9, 4, 9],
    iconAllowOverlap: true,
  };
}

// ── Friends ─────────────────────────────────────────────────────────────────

/** A friend at a venue: a cyan ring with their initial (or "+2"), beside the beam at the roof. */
export const FRIEND_AVATAR_STYLE: SymbolLayerStyleProps = {
  iconImage: FRIEND_RING,
  iconOffset: ['get', 'iconOffset'],
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
  textField: ['get', 'text'],
  textFont: MAP_FONT,
  textSize: FRIEND_MARK.initialSize,
  textColor: colors.you,
  textOffset: ['get', 'textOffset'],
  textAllowOverlap: true,
  textIgnorePlacement: true,
  symbolZOffset: ON_THE_ROOF,
};

/** The name of the venue the friends are at, to the right of their rings. */
export const FRIEND_VENUE_STYLE: SymbolLayerStyleProps = {
  textField: ['get', 'text'],
  textFont: MAP_FONT,
  textSize: FRIEND_MARK.nameSize,
  textAnchor: 'left',
  textJustify: 'left',
  textOffset: ['get', 'textOffset'],
  textColor: colors.label,
  textHaloColor: colors.bg,
  textHaloWidth: 1.4,
  textHaloBlur: 0.8,
  textAllowOverlap: true,
  textIgnorePlacement: true,
  symbolZOffset: ON_THE_ROOF,
};

// ── Signs ───────────────────────────────────────────────────────────────────

/**
 * The thin coloured slab on the wall under a sign: stretched like the buildings. If the 3D panel
 * in front of it cannot be drawn, this is what marks the sign (and it is what a tap lands on).
 */
export const SIGN_SLAB_STYLE: FillExtrusionLayerStyleProps = {
  fillExtrusionColor: ['get', 'fill'],
  fillExtrusionBase: growing(['get', 'base']),
  fillExtrusionHeight: growing(['get', 'top']),
  fillExtrusionOpacity: 1,
  fillExtrusionVerticalGradient: false,
};

/**
 * The sign itself: a flat 3D panel carrying the sign's picture, standing just in front of the
 * wall. Each feature says which model, how big, turned which way and how high.
 */
export const SIGN_PANEL_STYLE: ModelLayerStyleProps = {
  modelId: ['get', 'model'],
  modelScale: ['get', 'scale'],
  modelRotation: ['get', 'rotation'],
  modelTranslation: ['get', 'translation'],
  // A sign is a light: shown at its own colours, not shaded by the map's light.
  modelEmissiveStrength: 1,
  modelType: 'common-3d',
};

/** Height above the ground of a hologram or an "Ad" tag, stretched like the buildings. */
const SIGN_HEIGHT: Expr = growing(['get', 'z']);

/** A hologram floating over a roof: a picture standing upright, facing the camera, sized in points. */
export const SIGN_HOLOGRAM_STYLE: SymbolLayerStyleProps = {
  iconImage: ['get', 'image'],
  iconSize: zoomStops(SIGN.hologramByZoom),
  iconAnchor: 'bottom',
  iconPitchAlignment: 'viewport',
  iconRotationAlignment: 'viewport',
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
  symbolZOffset: SIGN_HEIGHT,
};

/** The amber "Ad" block over a paid wall panel. */
export const SIGN_TAG_STYLE: SymbolLayerStyleProps = {
  iconImage: ['get', 'image'],
  iconSize: zoomStops(SIGN.tagByZoom),
  iconAnchor: 'bottom',
  iconPitchAlignment: 'viewport',
  iconRotationAlignment: 'viewport',
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
  symbolZOffset: SIGN_HEIGHT,
};

// ── Route ───────────────────────────────────────────────────────────────────

export const ROUTE_GLOW_STYLE: LineLayerStyleProps = {
  lineColor: colors.you,
  lineWidth: 14,
  lineOpacity: 0.3,
  lineBlur: 8,
  lineCap: 'round',
  lineJoin: 'round',
};

export const ROUTE_LINE_STYLE: LineLayerStyleProps = {
  lineColor: colors.you,
  lineWidth: 4.5,
  lineCap: 'round',
  lineJoin: 'round',
};

/** The thin white line down the middle of the route, as in the mock. */
export const ROUTE_CORE_STYLE: LineLayerStyleProps = {
  lineColor: colors.label,
  lineWidth: 1.4,
  lineOpacity: 0.9,
  lineCap: 'round',
  lineJoin: 'round',
};

// ── You ─────────────────────────────────────────────────────────────────────

/** A cyan disc on the ground around you; tilted, it lies flat as an ellipse like the mock's. */
export const YOU_GLOW_STYLE: CircleLayerStyleProps = {
  circleColor: colors.you,
  circleRadius: 20,
  circleOpacity: 0.2,
  circleStrokeColor: colors.you,
  circleStrokeWidth: 1.2,
  circleStrokeOpacity: 0.7,
  circlePitchAlignment: 'map',
};

export const YOU_DOT_STYLE: CircleLayerStyleProps = {
  circleColor: colors.you,
  circleRadius: 6,
};

/** The white centre of your dot. */
export const YOU_CENTRE_STYLE: CircleLayerStyleProps = {
  circleColor: colors.label,
  circleRadius: 2.5,
};
