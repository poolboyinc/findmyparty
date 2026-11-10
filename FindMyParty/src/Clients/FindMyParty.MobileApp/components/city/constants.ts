// Everything about the city map that is a number, a name or a switch lives here.

/** A map coordinate the way Mapbox and GeoJSON order it: longitude first. */
export type LngLat = [longitude: number, latitude: number];

// ── Style ───────────────────────────────────────────────────────────────────

/** Mapbox Standard: the 3D city, lit by a light preset set in `city-style.tsx`. */
export const STANDARD_STYLE_URL = 'mapbox://styles/mapbox/standard';
/** The older dark style. With it the app draws its own dark-violet buildings. */
export const FALLBACK_STYLE_URL = 'mapbox://styles/mapbox/dark-v11';
/**
 * Flip to `false` if the night preset does not take on a device: the map then loads the
 * fallback style and `city-style.tsx` extrudes the `building` layer itself.
 */
export const USE_STANDARD_STYLE: boolean = true;
export const MAP_STYLE_URL = USE_STANDARD_STYLE ? STANDARD_STYLE_URL : FALLBACK_STYLE_URL;

/** Standard is loaded as an import called "basemap"; its options are set on that id. */
export const BASEMAP_IMPORT_ID = 'basemap';
/** The light. Set alone so that nothing else can stop the night from applying. */
export const BASEMAP_LIGHT = { lightPreset: 'night' } as const;
/**
 * Which of Standard's own labels to keep: places and roads, not shops or bus stops.
 * These are real booleans on purpose: Standard reads the text "false" as true.
 */
export const BASEMAP_LABELS = {
  showPointOfInterestLabels: false,
  showTransitLabels: false,
  showPlaceLabels: true,
  showRoadLabels: true,
} as const;

// ── Camera ──────────────────────────────────────────────────────────────────

export const CITY = {
  name: 'Podgorica',
  center: [19.2594, 42.4411] as LngLat,
} as const;

export const CAMERA = {
  zoom: 14.3,
  /** Tilted is how the city is meant to be seen. */
  pitch: 58,
  heading: -17,
  /** How close locate-me goes. */
  locateZoom: 15.6,
  /** Below this pitch the map counts as flat (2D); above `tiltedAbovePitch` as tilted. */
  flatBelowPitch: 10,
  tiltedAbovePitch: 20,
  /** Durations in milliseconds; the map does the easing. */
  tiltMs: 700,
  focusMs: 450,
  flyMs: 1400,
  routeMs: 900,
} as const;

// ── Beams ───────────────────────────────────────────────────────────────────

export const BEAM = {
  /** Radius of the beam itself and of the faint wider one around it, in metres. */
  coreRadiusM: 7,
  haloRadiusM: 16,
  /** Corners of the polygon that stands in for a circle. */
  points: 24,
  /** Height in metres by strength (0 nothing known, 0.2 quiet, 1 the busiest). */
  heightAtNothing: 20,
  heightAtQuiet: 40,
  heightAtBusiest: 260,
  opacityLive: 0.85,
  opacityExpected: 0.5,
  opacityHalo: 0.16,
} as const;

// ── Labels ──────────────────────────────────────────────────────────────────

export const LABEL = {
  size: 13,
  selectedSize: 15,
  /**
   * Closer than this every venue is named; further out only the busy ones and the selected one.
   * The map checks a filter's zoom once per whole zoom level, so in practice this switches at 14.
   */
  allFromZoom: 13.5,
  /** "Busy" for the rule above. */
  minStrength: 0.4,
  /**
   * `true`: the name floats at the top of its beam (the map lifts it by the beam's height).
   * `false`: the name sits beside the beam's foot. Flip if lifted labels misbehave on a device.
   */
  atBeamTop: true as boolean,
} as const;

// ── Ids ─────────────────────────────────────────────────────────────────────
// Sources and layers are looked up by id inside the map, so each must be unique.

export const SOURCE = {
  route: 'city-route',
  venuePoints: 'city-venue-points',
  beams: 'city-beams',
  labels: 'city-venue-labels',
} as const;

export const LAYER = {
  buildings: 'city-buildings',
  routeGlow: 'city-route-glow',
  routeLine: 'city-route-line',
  discGlow: 'city-disc-glow',
  disc: 'city-disc',
  discRing: 'city-disc-ring',
  beamLive: 'city-beam-live',
  beamExpected: 'city-beam-expected',
  beamHalo: 'city-beam-halo',
  labels: 'city-labels',
  labelSelected: 'city-label-selected',
  youGlow: 'city-you-glow',
  youRing: 'city-you-ring',
  youDot: 'city-you-dot',
} as const;

/** Finger-sized square around a tap in which venues are looked for. */
export const TAP_HITBOX = { width: 48, height: 48 } as const;

/** What the venue sheet's height is taken to be until it has been measured once. */
export const SHEET_HEIGHT_GUESS = 320;
/** Room kept between the selected beam's foot and the top of the sheet. */
export const SHEET_CUSHION = 28;
