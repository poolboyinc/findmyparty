import { memo, useMemo } from 'react';
import type { LineString } from 'geojson';
import { LineLayer, ShapeSource } from '@rnmapbox/maps';
import { LAYER, SOURCE } from './constants';
import { routeCollection } from './geojson';
import { ROUTE_CORE_STYLE, ROUTE_GLOW_STYLE, ROUTE_LINE_STYLE } from './layer-styles';

type Props = {
  /** The walking route, or null for none. */
  line: LineString | null;
};

/**
 * The walking route: a cyan line with a wider, fainter one under it for glow and a thin white
 * line down its middle, as in the mock.
 * Always mounted, and mounted before the venue layers, so the line stays under the beams and
 * names; with no route it holds an empty collection and draws nothing.
 */
export const RouteLayer = memo(function RouteLayer({ line }: Props) {
  const shape = useMemo(() => routeCollection(line), [line]);

  return (
    <ShapeSource id={SOURCE.route} shape={shape}>
      <LineLayer id={LAYER.routeGlow} style={ROUTE_GLOW_STYLE} />
      <LineLayer id={LAYER.routeLine} style={ROUTE_LINE_STYLE} />
      <LineLayer id={LAYER.routeCore} style={ROUTE_CORE_STYLE} />
    </ShapeSource>
  );
});
