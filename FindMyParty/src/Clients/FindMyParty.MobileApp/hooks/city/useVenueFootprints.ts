import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { MapView } from '@rnmapbox/maps';
import { LAYER } from '@/components/city/constants';
import { footprintFromServer, pickFootprint, type Footprint } from '@/components/city/footprint';
import type { VenueOnMap } from '@/components/city/geojson';

/** Points around a venue in which its building is looked for. */
const SEARCH_PT = 60;

type Footprints = Readonly<Record<string, Footprint>>;

// One store for the whole app: the City tab and the welcome backdrop show the same venues, and a
// building found by one map does not have to be looked for again by the other.
let known: Footprints = {};
const listeners = new Set<() => void>();
let busy = false;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): Footprints {
  return known;
}

/** Where a venue was when its building was found; if the venue moves, the building is looked for again. */
const foundAt = new Map<string, string>();
const placeOf = (venue: VenueOnMap) => `${venue.longitude},${venue.latitude}`;

/** The outline the server holds for a venue's building, when the venue's host has picked one. */
function stored(venue: VenueOnMap): Footprint | null {
  return footprintFromServer(venue.footprint);
}

async function scan(map: MapView | null, venues: readonly VenueOnMap[]): Promise<void> {
  if (!map || busy) return;
  // A venue whose building the server knows needs no looking for.
  const missing = venues.filter((venue) => !stored(venue) && foundAt.get(venue.id) !== placeOf(venue));
  if (missing.length === 0) return;
  busy = true;
  let next: Record<string, Footprint> | null = null;
  try {
    for (const venue of missing) {
      try {
        const at: [number, number] = [venue.longitude, venue.latitude];
        const [x, y] = await map.getPointInView(at);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        // [top, right, bottom, left] in points (RNMBXMapViewManager.queryRenderedFeaturesInRect).
        const result = await map.queryRenderedFeaturesInRect(
          [y - SEARCH_PT, x + SEARCH_PT, y + SEARCH_PT, x - SEARCH_PT],
          [],
          [LAYER.buildings],
        );
        const footprint = pickFootprint(at, result?.features ?? []);
        if (footprint) {
          next ??= { ...known };
          next[venue.id] = footprint;
          foundAt.set(venue.id, placeOf(venue));
        }
      } catch {
        // Off screen, or the map is between styles: try again on the next scan.
      }
    }
  } finally {
    busy = false;
    if (next) {
      known = next;
      listeners.forEach((listener) => listener());
    }
  }
}

/**
 * The real building each venue is in, so the venue lights up its own roof and its beam stands on
 * it (and its walls can carry signs). The server's outline is used when the venue has one;
 * otherwise the building is found from the buildings a map has drawn. Call `scan` when a map
 * settles; venues found once are kept, the rest are tried again on the next scan.
 */
export function useVenueFootprints(venues: readonly VenueOnMap[]) {
  const found = useSyncExternalStore(subscribe, snapshot, snapshot);
  const footprints = useMemo(() => {
    let merged: Record<string, Footprint> | null = null;
    for (const venue of venues) {
      const fromServer = stored(venue);
      if (fromServer) {
        merged ??= { ...found };
        merged[venue.id] = fromServer;
      }
    }
    return merged ?? found;
  }, [venues, found]);
  const scanMap = useCallback((map: MapView | null) => scan(map, venues), [venues]);
  return { footprints, scan: scanMap };
}
