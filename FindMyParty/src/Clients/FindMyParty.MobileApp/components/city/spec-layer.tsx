import { memo } from 'react';
import { BackgroundLayer, CircleLayer, FillExtrusionLayer, FillLayer, LineLayer, ModelLayer, SymbolLayer } from '@rnmapbox/maps';
import type { LayerSpec } from './layers';

/** One entry of layers.ts as the Mapbox layer it describes. */
export const SpecLayer = memo(function SpecLayer({ spec }: { spec: LayerSpec }) {
  const common = {
    id: spec.id,
    existing: spec.existing,
    sourceID: spec.source,
    sourceLayerID: spec.sourceLayer,
    belowLayerID: spec.below,
    filter: spec.filter,
  };
  const zoom = { minZoomLevel: spec.minZoom, maxZoomLevel: spec.maxZoom };
  switch (spec.type) {
    case 'background':
      return <BackgroundLayer {...common} {...zoom} style={spec.style} />;
    case 'fill':
      return <FillLayer {...common} {...zoom} style={spec.style} />;
    case 'line':
      return <LineLayer {...common} {...zoom} style={spec.style} />;
    case 'circle':
      return <CircleLayer {...common} {...zoom} style={spec.style} />;
    case 'symbol':
      return <SymbolLayer {...common} {...zoom} style={spec.style} />;
    case 'model':
      return <ModelLayer {...common} {...zoom} style={spec.style} />;
    case 'fillExtrusion':
      // The package's FillExtrusionLayer types require both zoom bounds.
      return (
        <FillExtrusionLayer
          {...common}
          minZoomLevel={spec.minZoom ?? 0}
          maxZoomLevel={spec.maxZoom ?? 24}
          style={spec.style}
        />
      );
  }
});

/** A list of entries, in order. */
export function SpecLayers({ specs }: { specs: readonly LayerSpec[] }) {
  return (
    <>
      {specs.map((spec) => (
        <SpecLayer key={spec.id} spec={spec} />
      ))}
    </>
  );
}
