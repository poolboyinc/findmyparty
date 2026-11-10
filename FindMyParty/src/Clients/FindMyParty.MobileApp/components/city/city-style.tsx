import type { ComponentProps } from 'react';
import { FillExtrusionLayer, StyleImport } from '@rnmapbox/maps';
import {
  BASEMAP_IMPORT_ID,
  BASEMAP_LABELS,
  BASEMAP_LIGHT,
  LAYER,
  USE_STANDARD_STYLE,
} from './constants';
import { BUILDINGS_FILTER, BUILDINGS_STYLE } from './layer-styles';

type ImportConfig = ComponentProps<typeof StyleImport>['config'];

// The package types every option as text, but hands the values to Mapbox untouched
// (RNMBXStyleImportComponentView.mm → RNMBXStyleImport.swift → setStyleImportConfigProperties).
// Standard's label switches are booleans, and it reads the text "false" as true, so they go as booleans.
const LABEL_SWITCHES = BASEMAP_LABELS as unknown as ImportConfig;

/**
 * Makes the city dark. Goes inside the map view, before the app's own layers.
 * With Mapbox Standard that is the night light preset, set on the "basemap" import; shop and
 * transit labels are switched off, place and road names stay.
 * The two settings are separate imports on purpose: if the label switches were ever refused,
 * the night would still apply.
 * With the fallback style there is no light to set, so the buildings are extruded here instead.
 */
export function CityStyle() {
  if (USE_STANDARD_STYLE) {
    return (
      <>
        <StyleImport id={BASEMAP_IMPORT_ID} existing config={BASEMAP_LIGHT} />
        <StyleImport id={BASEMAP_IMPORT_ID} existing config={LABEL_SWITCHES} />
      </>
    );
  }

  return (
    <FillExtrusionLayer
      id={LAYER.buildings}
      sourceID="composite"
      sourceLayerID="building"
      filter={BUILDINGS_FILTER}
      minZoomLevel={13}
      maxZoomLevel={24}
      style={BUILDINGS_STYLE}
    />
  );
}
