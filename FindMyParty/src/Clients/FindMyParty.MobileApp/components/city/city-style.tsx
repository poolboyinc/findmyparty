import { memo } from 'react';
import { Atmosphere, Images, Light } from '@rnmapbox/maps';
import { SPRITE_IMAGES } from './city-images';
import { FACADE_IMAGE, FACADE_IMAGE_SCALE, SWITCH } from './constants';
import { ATMOSPHERE_STYLE, LIGHT_STYLE } from './layer-styles';
import { cityLayers } from './layers';
import { SpecLayers } from './spec-layer';

const FACADE = require('@/assets/images/city-facade.png');

/** Images the map's layers use: the facade with lit windows, the selected name's white block, the lights. */
const IMAGES = {
  [FACADE_IMAGE]: { image: FACADE, scale: FACADE_IMAGE_SCALE },
  ...SPRITE_IMAGES,
};

const LAYERS = cityLayers();

/**
 * Turns Mapbox's dark-v11 into the mock's city: the layers of `cityLayers()` (layers.ts), a violet
 * haze towards the horizon and, optionally, a cool violet light. Every switch is in `SWITCH`
 * (constants.ts).
 */
export const CityStyle = memo(function CityStyle() {
  return (
    <>
      <Images images={IMAGES} />
      {SWITCH.atmosphere ? <Atmosphere style={ATMOSPHERE_STYLE} /> : null}
      {SWITCH.light ? <Light style={LIGHT_STYLE} /> : null}
      <SpecLayers specs={LAYERS} />
    </>
  );
});
