import { useCallback, useRef, useState } from 'react';
import type { MapView } from '@rnmapbox/maps';
import { LAYER } from '@/components/city/constants';
import { pickFootprint, type Footprint } from '@/components/city/footprint';
import type { VenueSummary } from '@/types/api';

/** Points around a venue in which its building is looked for. */
const SEARCH_PT = 60;

/**
 * Finds the real building each venue is in, from the buildings the map has drawn, so the venue
 * lights up its own roof (and, later, its own walls can carry signs). Call `scan` when the map
 * settles; venues found once are kept, the rest are tried again on the next scan.
 */
export function useVenueFootprints() {
  const [footprints, setFootprints] = useState<Readonly<Record<string, Footprint>>>({});
  const found = useRef<Record<string, Footprint>>({});
  const busy = useRef(false);

  const scan = useCallback(async (map: MapView | null, venues: readonly VenueSummary[]) => {
    if (!map || busy.current) return;
    const missing = venues.filter((venue) => !found.current[venue.id]);
    if (missing.length === 0) return;
    busy.current = true;
    let changed = false;
    try {
      for (const venue of missing) {
        try {
          const [x, y] = await map.getPointInView([venue.longitude, venue.latitude]);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          // [top, right, bottom, left] in points (RNMBXMapViewManager.queryRenderedFeaturesInRect).
          const result = await map.queryRenderedFeaturesInRect(
            [y - SEARCH_PT, x + SEARCH_PT, y + SEARCH_PT, x - SEARCH_PT],
            [],
            [LAYER.buildings],
          );
          const footprint = pickFootprint([venue.longitude, venue.latitude], result?.features ?? []);
          if (footprint) {
            found.current = { ...found.current, [venue.id]: footprint };
            changed = true;
          }
        } catch {
          // Off screen, or the map is between styles: try again on the next scan.
        }
      }
    } finally {
      busy.current = false;
      if (changed) setFootprints(found.current);
    }
  }, []);

  return { footprints, scan };
}
