import { memo, useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { ShapeSource } from '@rnmapbox/maps';
import { useReducedMotion } from '@/components/afterglow/motion';
import { PULSE, SOURCE, TAP_HITBOX } from './constants';
import type { Footprint } from './footprint';
import { friendMarks, tappedVenueId, venuePoints, venueShapes, type CityMode, type FriendsOnMap, type VenueOnMap } from './geojson';
import { friendLayers, pingLayers, venueLayers } from './layers';
import { SpecLayers } from './spec-layer';

type PressEvent = Parameters<NonNullable<ComponentProps<typeof ShapeSource>['onPress']>>[0];

type Props = {
  venues: readonly VenueOnMap[];
  selectedId: string | null;
  /** 2D: beams off, discs sized by the crowd. */
  flat: boolean;
  /** Live, My City, or Friends. */
  mode?: CityMode;
  /** Friends layer: who is at which venue. */
  friends?: readonly FriendsOnMap[];
  /** My City: the venues the user has been scanned into. */
  earned?: ReadonlySet<string>;
  /** Names on the map. Off for the welcome backdrop. */
  labels?: boolean;
  /** The real building of each venue that has been found on the map. */
  footprints?: Readonly<Record<string, Footprint>>;
  /** Busy venues send a slow ripple out from their roof. Off for still pictures and with Reduce Motion. */
  pulse?: boolean;
  /** Without it the venues cannot be tapped (the backdrop). */
  onSelect?: (venueId: string) => void;
};

const NONE: ReadonlySet<string> = new Set();
const NO_FRIENDS: readonly FriendsOnMap[] = [];
const FRIEND_LAYERS = friendLayers();
/** Steps in one pulse: the three ripples, then a rest. */
const PULSE_STEPS = PULSE.sizes.length + 1;
const AT_REST: number = PULSE.sizes.length;

/** Where the pulse is right now: 0, 1, 2 for the ripples, then a rest. Stays at rest when off. */
function usePulseStep(on: boolean): number {
  const [step, setStep] = useState(AT_REST);
  useEffect(() => {
    if (!on) {
      setStep(AT_REST);
      return;
    }
    const timer = setInterval(() => setStep((current) => (current + 1) % PULSE_STEPS), PULSE.stepMs);
    return () => clearInterval(timer);
  }, [on]);
  return step;
}

/**
 * Every venue as light, drawn by the map itself (no React view per venue): see `venueLayers()` in
 * layers.ts for what is drawn and in which order. Tapping a beam, a ring or a name selects the venue.
 */
export const VenueLayers = memo(function VenueLayers({
  venues,
  selectedId,
  flat,
  mode = 'live',
  earned = NONE,
  friends = NO_FRIENDS,
  labels = true,
  footprints,
  pulse = false,
  onSelect,
}: Props) {
  const reduceMotion = useReducedMotion();
  const step = usePulseStep(pulse && !flat && !reduceMotion);
  const pings = useMemo(() => pingLayers(flat, step), [flat, step]);
  const drawing = useMemo(
    () => ({ selectedId, mode, earned, flat, footprints }),
    [selectedId, mode, earned, flat, footprints],
  );
  const points = useMemo(() => venuePoints(venues, drawing), [venues, drawing]);
  const shapes = useMemo(() => venueShapes(venues, drawing), [venues, drawing]);
  const friendsMode = mode === 'friends';
  // On the Friends layer the venues go unnamed; the friends' marks carry the names.
  const layers = useMemo(() => venueLayers(flat, labels && !friendsMode, friendsMode), [flat, labels, friendsMode]);
  const marks = useMemo(
    () => friendMarks(friendsMode ? friends : NO_FRIENDS, footprints, flat),
    [friendsMode, friends, footprints, flat],
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
        <SpecLayers specs={layers.ground} />
      </ShapeSource>
      <ShapeSource id={SOURCE.venueShapes} shape={shapes} {...press}>
        <SpecLayers specs={layers.shapes} />
      </ShapeSource>
      <ShapeSource id={SOURCE.venueLights} shape={points} {...press}>
        <SpecLayers specs={pings} />
        <SpecLayers specs={layers.lights} />
      </ShapeSource>
      <ShapeSource id={SOURCE.friends} shape={marks} {...press}>
        <SpecLayers specs={FRIEND_LAYERS} />
      </ShapeSource>
    </>
  );
});
