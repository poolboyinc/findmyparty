import { memo, useCallback, useMemo, type ComponentProps } from 'react';
import { CircleLayer, FillExtrusionLayer, ShapeSource, SymbolLayer } from '@rnmapbox/maps';
import type { VenueSummary } from '@/types/api';
import { BEAM, LAYER, SOURCE, TAP_HITBOX } from './constants';
import { tappedVenueId, venueBeams, venuePoints, type CityMode } from './geojson';
import {
  FILTER,
  beamStyle,
  blockStyle,
  countStyle,
  discDotStyle,
  discGlowStyle,
  discRingStyle,
  discStyle,
  nameStyle,
  selectedLabelStyle,
} from './layer-styles';

type PressEvent = Parameters<NonNullable<ComponentProps<typeof ShapeSource>['onPress']>>[0];

type Props = {
  venues: readonly VenueSummary[];
  selectedId: string | null;
  /** 2D: beams off, discs sized by the crowd. */
  flat: boolean;
  /** Live, or My City. */
  mode?: CityMode;
  /** My City: the venues the user has been scanned into. */
  earned?: ReadonlySet<string>;
  /** Names on the map. Off for the welcome backdrop. */
  labels?: boolean;
  /** Without it the venues cannot be tapped (the backdrop). */
  onSelect?: (venueId: string) => void;
};

// The package's FillExtrusionLayer requires both; these are the widest values the style allows.
const ANY_ZOOM = { minZoomLevel: 0, maxZoomLevel: 24 } as const;
const NONE: ReadonlySet<string> = new Set();

/**
 * Every venue as light, drawn by the map itself (no React view per venue).
 *
 * Bottom to top, which is the order the layers are mounted in:
 *   pools of light and discs on the ground → the white core → the beam in three pieces, fading
 *   upwards → My City ghosts → the ring → the faint wide beam → names, crowd lines, the selected block.
 *
 * Order matters for the see-through extrusions: an extrusion that lies behind one drawn earlier is
 * not drawn at all. So the thin core goes first (it shows through the beam around it), and the wide
 * faint beam last (it would hide everything inside it).
 *
 * Tapping a beam, a disc or a name selects the venue.
 */
export const VenueLayers = memo(function VenueLayers({
  venues,
  selectedId,
  flat,
  mode = 'live',
  earned = NONE,
  labels = true,
  onSelect,
}: Props) {
  const drawing = useMemo(() => ({ selectedId, mode, earned, flat }), [selectedId, mode, earned, flat]);
  const points = useMemo(() => venuePoints(venues, drawing), [venues, drawing]);
  const beams = useMemo(() => venueBeams(venues, drawing), [venues, drawing]);

  const styles = useMemo(
    () => ({
      discGlow: discGlowStyle(flat),
      disc: discStyle(flat),
      discDot: discDotStyle(flat),
      discRing: discRingStyle(flat),
      block: blockStyle(false, flat),
      edge: blockStyle(true, flat),
      core: beamStyle(BEAM.coreOpacity, flat),
      // The beam's three pieces (BEAM.pieces), brightest at the foot.
      pieces: [0, 1, 2].map((index) => beamStyle(BEAM.pieces[index].opacity, flat)),
      ghost: beamStyle(BEAM.opacityGhost, flat),
      ring: beamStyle(1, flat),
      halo: beamStyle(BEAM.opacityHalo, flat),
      name: nameStyle(flat),
      count: countStyle(flat),
      selected: selectedLabelStyle(flat),
    }),
    [flat],
  );

  const handlePress = useCallback(
    (event: PressEvent) => {
      const id = tappedVenueId(event.features);
      if (id) onSelect?.(id);
    },
    [onSelect],
  );
  const press = onSelect ? { onPress: handlePress, hitbox: TAP_HITBOX } : {};

  return (
    <>
      <ShapeSource id={SOURCE.venuePoints} shape={points} {...press}>
        <CircleLayer id={LAYER.discGlow} style={styles.discGlow} />
        <CircleLayer id={LAYER.disc} style={styles.disc} />
        <CircleLayer id={LAYER.discDot} style={styles.discDot} />
        <CircleLayer id={LAYER.discRing} filter={FILTER.selected} style={styles.discRing} />
      </ShapeSource>

      <ShapeSource id={SOURCE.beams} shape={beams} {...press}>
        <FillExtrusionLayer id={LAYER.venueBlock} filter={FILTER.block} style={styles.block} {...ANY_ZOOM} />
        <FillExtrusionLayer id={LAYER.venueEdge} filter={FILTER.edge} style={styles.edge} {...ANY_ZOOM} />
        <FillExtrusionLayer id={LAYER.beamCore} filter={FILTER.core} style={styles.core} {...ANY_ZOOM} />
        <FillExtrusionLayer id={`${LAYER.beamPiece}0`} filter={FILTER.piece(0)} style={styles.pieces[0]} {...ANY_ZOOM} />
        <FillExtrusionLayer id={`${LAYER.beamPiece}1`} filter={FILTER.piece(1)} style={styles.pieces[1]} {...ANY_ZOOM} />
        <FillExtrusionLayer id={`${LAYER.beamPiece}2`} filter={FILTER.piece(2)} style={styles.pieces[2]} {...ANY_ZOOM} />
        <FillExtrusionLayer id={LAYER.beamGhost} filter={FILTER.ghost} style={styles.ghost} {...ANY_ZOOM} />
        <FillExtrusionLayer id={LAYER.beamRing} filter={FILTER.ring} style={styles.ring} {...ANY_ZOOM} />
        <FillExtrusionLayer id={LAYER.beamHalo} filter={FILTER.halo} style={styles.halo} {...ANY_ZOOM} />
      </ShapeSource>

      {labels ? (
        <ShapeSource id={SOURCE.labels} shape={points} {...press}>
          <SymbolLayer id={LAYER.labelNames} filter={FILTER.names} style={styles.name} />
          <SymbolLayer id={LAYER.labelCounts} filter={FILTER.counts} style={styles.count} />
          <SymbolLayer id={LAYER.labelSelected} filter={FILTER.selected} style={styles.selected} />
        </ShapeSource>
      ) : null}
    </>
  );
});
