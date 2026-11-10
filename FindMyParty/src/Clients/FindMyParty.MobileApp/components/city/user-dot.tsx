import { useCallback, useRef, type ComponentProps } from 'react';
import { CircleLayer, UserLocation } from '@rnmapbox/maps';
import { LAYER, type LngLat } from './constants';
import { YOU_DOT_STYLE, YOU_GLOW_STYLE, YOU_RING_STYLE } from './layer-styles';

type PositionUpdate = Parameters<NonNullable<ComponentProps<typeof UserLocation>['onUpdate']>>[0];

type Props = {
  /**
   * The dot was tapped. It is drawn above everything and takes the taps around it, so the
   * screen uses this to select a venue you are standing at.
   */
  onPress?: (at: LngLat) => void;
};

/**
 * Where you are, in the "you" colour. The package's UserLocation draws whatever layers it is
 * given as children, which is how the colour is set (its native puck only takes images).
 *
 * Mount this only once location permission is granted: the package's location manager asks
 * the system for permission the moment it starts.
 */
export function UserDot({ onPress }: Props) {
  const last = useRef<LngLat | null>(null);

  const handleUpdate = useCallback((position: PositionUpdate) => {
    last.current = [position.coords.longitude, position.coords.latitude];
  }, []);

  const handlePress = useCallback(() => {
    if (last.current) onPress?.(last.current);
  }, [onPress]);

  return (
    <UserLocation visible animated minDisplacement={3} onUpdate={handleUpdate} onPress={handlePress}>
      <CircleLayer key={LAYER.youGlow} id={LAYER.youGlow} style={YOU_GLOW_STYLE} />
      <CircleLayer key={LAYER.youRing} id={LAYER.youRing} style={YOU_RING_STYLE} />
      <CircleLayer key={LAYER.youDot} id={LAYER.youDot} style={YOU_DOT_STYLE} />
    </UserLocation>
  );
}
