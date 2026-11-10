import { memo, useCallback, useMemo, type ComponentProps } from 'react';
import { CircleLayer, FillExtrusionLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import type { VenueSummary } from '@/types/api';
import { BEAM, LAYER, SOURCE, TAP_HITBOX } from './constants';
import { tappedVenueId, venueBeams, venuePoints } from './geojson';
import { FILTER, beamStyle, discGlowStyle, discRingStyle, discStyle, labelStyle } from './layer-styles';

type PressEvent = Parameters<NonNullable<ComponentProps<typeof ShapeSource>['onPress']>>[0];

type Props = {
  venues: readonly VenueSummary[];
  selectedId: string | null;
  /** 2D: beams off, discs sized by the crowd. */
  flat: boolean;
  onSelect: (venueId: string) => void;
};

// The package's FillExtrusionLayer requires both; these are the widest values the style allows.
const ANY_ZOOM = { minZoomLevel: 0, maxZoomLevel: 24 } as const;

/**
 * Every venue as light, drawn by the map itself (no React view per venue).
 *
 * Bottom to top, which is the order the layers are mounted in:
 *   discs on the ground → beams → the faint wide beam around each → names.
 * None of them is given a slot: under Mapbox Standard a layer without a slot goes above the whole
 * basemap, 3D buildings included, and this package's FillExtrusionLayer has no `slot` prop anyway.
 * The wide faint beam must come after the beams: drawn first it would hide them, because
 * extrusions that are behind an earlier one are not drawn.
 *
 * Tapping a beam, a disc or a name selects the venue.
 */
export const VenueLayers = memo(function VenueLayers({ venues, selectedId, flat, onSelect }: Props) {
  const points = useMemo(() => venuePoints(venues, selectedId), [venues, selectedId]);
  const beams = useMemo(() => venueBeams(venues, selectedId), [venues, selectedId]);

  const styles = useMemo(
    () => ({
      discGlow: discGlowStyle(flat),
      disc: discStyle(flat),
      discRing: discRingStyle(flat),
      beamLive: beamStyle(BEAM.opacityLive, flat),
      beamExpected: beamStyle(BEAM.opacityExpected, flat),
      beamHalo: beamStyle(BEAM.opacityHalo, flat),
      label: labelStyle(flat, false),
      labelSelected: labelStyle(flat, true),
    }),
    [flat],
  );

  const handlePress = useCallback(
    (event: PressEvent) => {
      const id = tappedVenueId(event.features);
      if (id) onSelect(id);
    },
    [onSelect],
  );

  return (
    <>
      <ShapeSource id={SOURCE.venuePoints} shape={points} onPress={handlePress} hitbox={TAP_HITBOX}>
        <CircleLayer id={LAYER.discGlow} style={styles.discGlow} />
        <CircleLayer id={LAYER.disc} style={styles.disc} />
        <CircleLayer id={LAYER.discRing} filter={FILTER.selected} style={styles.discRing} />
      </ShapeSource>

      <ShapeSource id={SOURCE.beams} shape={beams} onPress={handlePress} hitbox={TAP_HITBOX}>
        <FillExtrusionLayer id={LAYER.beamLive} filter={FILTER.beamLive} style={styles.beamLive} {...ANY_ZOOM} />
        <FillExtrusionLayer
          id={LAYER.beamExpected}
          filter={FILTER.beamExpected}
          style={styles.beamExpected}
          {...ANY_ZOOM}
        />
        <FillExtrusionLayer id={LAYER.beamHalo} filter={FILTER.beamHalo} style={styles.beamHalo} {...ANY_ZOOM} />
      </ShapeSource>

      <ShapeSource id={SOURCE.labels} shape={points} onPress={handlePress} hitbox={TAP_HITBOX}>
        <SymbolLayer id={LAYER.labels} filter={FILTER.labels} style={styles.label} />
        <SymbolLayer id={LAYER.labelSelected} filter={FILTER.selected} style={styles.labelSelected} />
      </ShapeSource>
    </>
  );
});
