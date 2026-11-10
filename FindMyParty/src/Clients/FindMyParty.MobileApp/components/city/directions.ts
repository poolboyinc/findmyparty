// The walking route from Mapbox Directions, and how its time and distance are worded.

import type { LineString, Position } from 'geojson';
import type { LngLat } from './constants';

/** One manoeuvre on the way, from the Directions steps. */
export type TurnStep = {
  /** Where the manoeuvre happens. */
  at: LngLat;
  /** Directions' maneuver type: "depart", "turn", "arrive", … */
  type: string;
  /** "left", "slight right", "straight", "uturn", … or '' when there is none. */
  modifier: string;
  /** The street the step continues on; '' when it has no name. */
  street: string;
};

export type WalkingRoute = {
  line: LineString;
  /** The manoeuvres in order, from "depart" to "arrive". Empty when Directions sent none. */
  steps: TurnStep[];
  seconds: number;
  metres: number;
  /** Opposite corners of the box around the line, for framing it on the map. */
  ne: LngLat;
  sw: LngLat;
};

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** The steps of a route's first leg; anything malformed is skipped. */
function parseSteps(route: Record<string, unknown>): TurnStep[] {
  const legs = route.legs;
  if (!Array.isArray(legs) || !isRecord(legs[0]) || !Array.isArray(legs[0].steps)) return [];
  const steps: TurnStep[] = [];
  for (const step of legs[0].steps as unknown[]) {
    if (!isRecord(step) || !isRecord(step.maneuver) || !isPosition(step.maneuver.location)) continue;
    const [lng, lat] = step.maneuver.location;
    steps.push({ at: [lng, lat], type: text(step.maneuver.type), modifier: text(step.maneuver.modifier), street: text(step.name) });
  }
  return steps;
}

/** Reads the first route out of a Directions response; null when it is not there or malformed. */
export function parseRoute(json: unknown): WalkingRoute | null {
  if (!isRecord(json) || !Array.isArray(json.routes)) return null;
  const first: unknown = json.routes[0];
  if (!isRecord(first) || !isRecord(first.geometry)) return null;

  const { coordinates, type } = first.geometry;
  if (type !== 'LineString' || !Array.isArray(coordinates)) return null;
  const points = coordinates.filter(isPosition);
  if (points.length < 2 || points.length !== coordinates.length) return null;

  const seconds = typeof first.duration === 'number' ? first.duration : NaN;
  const metres = typeof first.distance === 'number' ? first.distance : NaN;
  if (!Number.isFinite(seconds) || !Number.isFinite(metres)) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of points) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }

  return {
    line: { type: 'LineString', coordinates: points },
    steps: parseSteps(first),
    seconds,
    metres,
    ne: [east, north],
    sw: [west, south],
  };
}

/**
 * Asks Mapbox Directions for the way on foot. Throws when the request fails or returns no route.
 * Same endpoint the old map used, always with the walking profile.
 */
export async function fetchWalkingRoute(
  from: LngLat,
  to: LngLat,
  token: string,
  signal?: AbortSignal,
): Promise<WalkingRoute> {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${from[0]},${from[1]};${to[0]},${to[1]}` +
    `?geometries=geojson&overview=full&steps=true&access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Directions answered ${response.status}`);
  const route = parseRoute(await response.json());
  if (!route) throw new Error('Directions returned no route');
  return route;
}

/** "7 min", "1 h 5 min". Never less than a minute. */
export function walkingTimeText(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "550 m" to the nearest ten metres, "1.2 km" from a kilometre up. */
export function distanceText(metres: number): string {
  const tens = Math.round(metres / 10) * 10;
  if (tens < 1000) return `${Math.max(10, tens)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/**
 * The next manoeuvre in words, as on the mock's banner: "Left on Njegoševa", "Straight on",
 * "Arrive at Monkey". `direction` picks the arrow.
 */
export function turnText(step: TurnStep, venueName: string): { title: string; direction: 'left' | 'right' | 'straight' | 'back' | 'arrive' } {
  if (step.type === 'arrive') return { title: `Arrive at ${venueName}`, direction: 'arrive' };
  const modifier = step.modifier;
  let verb = 'Straight';
  let direction: 'left' | 'right' | 'straight' | 'back' = 'straight';
  if (modifier === 'uturn') {
    verb = 'Turn around';
    direction = 'back';
  } else if (modifier.endsWith('left')) {
    verb = modifier === 'slight left' ? 'Bear left' : modifier === 'sharp left' ? 'Sharp left' : 'Left';
    direction = 'left';
  } else if (modifier.endsWith('right')) {
    verb = modifier === 'slight right' ? 'Bear right' : modifier === 'sharp right' ? 'Sharp right' : 'Right';
    direction = 'right';
  }
  return { title: step.street ? `${verb} on ${step.street}` : verb, direction };
}
