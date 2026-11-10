// The walking route from Mapbox Directions, and how its time and distance are worded.

import type { LineString, Position } from 'geojson';
import type { LngLat } from './constants';

export type WalkingRoute = {
  line: LineString;
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
    `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
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
